// Runs an arena around a RealtimeEngine: the one authority, the same code on
// the arena server and in the page for the solo arena. It keeps each
// person's latest input, tops the world up with bots to its minimum
// population, lets the bots steer, steps the world, and on snapshot ticks
// encodes each person's snapshot against the last one they were sent.
// No timers here: the platform calls step() at the engine's tick rate.

import { encodeSnapshotFrame, seqAfter } from "./arena-protocol";
import { Rng } from "./prng";
import {
  botsWanted,
  type ArenaBot,
  type ArenaBots,
  type ArenaJoiner,
  type RealtimeEngine,
} from "./realtime";

import type { BotDifficulty } from "./manifest";

export interface ArenaHostOptions<Config> {
  seed: string;
  config: Config;
  /** People and bots together that the arena keeps at least (SPEC §10.8: 10 by default). */
  minimumPopulation: number;
  /** Most people at once; the rest of the engine's capacity is for bots. */
  maxPeople: number;
  /** The difficulties bots take, in turn. */
  botDifficulties: readonly BotDifficulty[];
  /** The n-th bot's name and look (n counts up from 0). */
  botJoiner: (n: number, difficulty: BotDifficulty) => Omit<ArenaJoiner, "bot">;
  /** Ticks before a knocked-out bot comes back. */
  botRespawnTicks: number;
}

interface Person<Input, Snapshot> {
  input: Input | undefined;
  /** The last input seq applied (0 before any). */
  ack: number;
  /** The last snapshot this person was sent, for the next delta. */
  previous: Snapshot | null;
}

interface BotSeat<World, Input> {
  bot: ArenaBot<World, Input> | undefined;
  input: Input | undefined;
  /** Spreads bots' decisions over different ticks. */
  phase: number;
  /** The tick it was knocked out on, or null while in play. */
  outSince: number | null;
}

export interface ArenaStep<Event> {
  events: Event[];
  /** Snapshot frames to send, per person, on snapshot ticks (empty otherwise). */
  frames: Map<number, Uint8Array<ArrayBuffer>>;
}

export class ArenaHost<World, Input, Snapshot, Event, Config> {
  readonly world: World;
  private readonly people = new Map<number, Person<Input, Snapshot>>();
  private readonly botSeats = new Map<number, BotSeat<World, Input>>();
  private readonly rng: Rng;
  private readonly snapshotEvery: number;
  private bornBots = 0;
  private tickCount = 0;

  constructor(
    private readonly engine: RealtimeEngine<World, Input, Snapshot, Event, Config>,
    private readonly bots: ArenaBots<World, Input>,
    private readonly options: ArenaHostOptions<Config>,
  ) {
    this.world = engine.createWorld(options.config, options.seed);
    this.rng = Rng.fromSeed(`${options.seed}:bots`);
    this.snapshotEvery = Math.max(1, Math.round(engine.ticksPerSecond / engine.snapshotsPerSecond));
    this.balance();
  }

  get tick(): number {
    return this.tickCount;
  }

  get peopleCount(): number {
    return this.people.size;
  }

  get botCount(): number {
    return this.botSeats.size;
  }

  /** Adds a person; null when the arena has no room for another. */
  join(joiner: Omit<ArenaJoiner, "bot">): number | null {
    if (this.people.size >= this.options.maxPeople) return null;
    // Make room by sending a bot home when the world is full.
    let id = this.engine.join(this.world, { ...joiner, bot: null });
    if (id === null) {
      const botId = this.botSeats.keys().next().value;
      if (botId === undefined) return null;
      this.removeBot(botId);
      id = this.engine.join(this.world, { ...joiner, bot: null });
      if (id === null) return null;
    }
    this.people.set(id, { input: undefined, ack: 0, previous: null });
    this.balance();
    return id;
  }

  leave(id: number): void {
    if (!this.people.delete(id)) return;
    this.engine.leave(this.world, id);
    this.balance();
  }

  respawn(id: number): boolean {
    return this.people.has(id) && this.engine.respawn(this.world, id);
  }

  /** A person's input frame body; false when it's stale or doesn't decode. */
  input(id: number, seq: number, bytes: Uint8Array): boolean {
    const person = this.people.get(id);
    if (!person || (person.ack !== 0 && !seqAfter(seq, person.ack))) return false;
    const input = this.engine.inputCodec.decode(bytes);
    if (input === null) return false;
    person.input = input;
    person.ack = seq;
    return true;
  }

  /** The next snapshot to `id` is a full one (they reconnected). */
  resetDelta(id: number): void {
    const person = this.people.get(id);
    if (person) person.previous = null;
  }

  step(): ArenaStep<Event> {
    const inputs = new Map<number, Input>();
    for (const [id, person] of this.people)
      if (person.input !== undefined) inputs.set(id, person.input);
    for (const [id, seat] of this.botSeats) {
      if (!this.engine.alive(this.world, id)) {
        seat.outSince ??= this.tickCount;
        if (
          this.tickCount - seat.outSince >= this.options.botRespawnTicks &&
          this.engine.respawn(this.world, id)
        ) {
          seat.outSince = null;
        }
        continue;
      }
      if (seat.bot && (this.tickCount + seat.phase) % seat.bot.thinkEvery === 0) {
        seat.input = seat.bot.steer(this.world, id, { rng: this.rng });
      }
      if (seat.input !== undefined) inputs.set(id, seat.input);
    }
    const events = this.engine.step(this.world, inputs);
    this.tickCount++;
    const frames = new Map<number, Uint8Array<ArrayBuffer>>();
    if (this.tickCount % this.snapshotEvery === 0) {
      for (const [id, person] of this.people) {
        const snapshot = this.engine.snapshot(this.world, id);
        const bytes = this.engine.snapshotCodec.encode(snapshot, person.previous);
        person.previous = snapshot;
        frames.set(id, encodeSnapshotFrame(this.tickCount, person.ack, bytes));
      }
    }
    return { events, frames };
  }

  private balance(): void {
    const want = botsWanted(this.people.size, this.options.minimumPopulation, this.engine.capacity);
    while (this.botSeats.size > want) {
      const id = this.botSeats.keys().next().value;
      if (id === undefined) break;
      this.removeBot(id);
    }
    while (this.botSeats.size < want) {
      const n = this.bornBots++;
      const difficulties = this.options.botDifficulties;
      const difficulty = difficulties[n % difficulties.length] ?? "easy";
      const id = this.engine.join(this.world, {
        ...this.options.botJoiner(n, difficulty),
        bot: difficulty,
      });
      if (id === null) break;
      this.botSeats.set(id, {
        bot: this.bots[difficulty],
        input: undefined,
        phase: n,
        outSince: null,
      });
    }
  }

  private removeBot(id: number): void {
    this.botSeats.delete(id);
    this.engine.leave(this.world, id);
  }
}
