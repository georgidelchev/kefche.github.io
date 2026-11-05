// Real-time arena games (SPEC §9.4.2, §10.8). One authority runs the world in
// fixed ticks: the arena server online (ADR to come, Phase 9), or the page
// itself in the solo arena. Each participant sends inputs; the authority
// keeps the latest one per participant, steps the world, and sends each one
// a snapshot of what is near them. People and bots join and leave at any
// time (arenas are drop-in).
//
// Unlike the other engine kinds, a world is changed in place: an arena with
// dozens of moving bodies and hundreds of pickups steps 30 times a second,
// and copying it every tick would be most of the work. It stays
// deterministic all the same: no clocks and no Math.random, randomness only
// from the world's own RngState, so the same seed, joins and inputs give the
// same world everywhere (the solo arena's replay, tests).

import type { GameResult } from "./engines";
import type { BotDifficulty } from "./manifest";
import type { Rng } from "./prng";

/** Who joins a world. */
export interface ArenaJoiner {
  /** Shown beside them: a nickname, a guest's name, or a bot's name. */
  name: string;
  /** The bot's difficulty, or null for a person. */
  bot: BotDifficulty | null;
  /** A cosmetic choice the game defines (Worm Rush: the skin). */
  look: number;
}

export interface RealtimeEngine<World, Input, Snapshot, Event, Config = undefined> {
  readonly ticksPerSecond: number;
  /** Snapshots a second sent to each participant (a divisor of ticksPerSecond). */
  readonly snapshotsPerSecond: number;
  /** Most participants a world holds, people and bots together. */
  readonly capacity: number;
  createWorld(config: Config, seed: string): World;
  /** Puts a participant in the world; returns its id, or null when the world is full. */
  join(world: World, joiner: ArenaJoiner): number | null;
  /** Takes a participant out: they left, or were away too long (SPEC §10.5). */
  leave(world: World, id: number): void;
  /** Brings back a participant who is out of play (eliminated); false otherwise. */
  respawn(world: World, id: number): boolean;
  /** Whether participant `id` is in play now. */
  alive(world: World, id: number): boolean;
  /**
   * Advances the world one tick, in place, with each participant's latest
   * input (those without one keep doing what they did); returns what
   * happened in that tick, for the HUD, sounds and results.
   */
  step(world: World, inputs: ReadonlyMap<number, Input>): Event[];
  /** What participant `id` sees now, limited to around them (area of interest). */
  snapshot(world: World, id: number): Snapshot;
  /** A participant's result once they're out of play or leave (their life's score). */
  result(world: World, id: number): GameResult | null;
  /** Binary frames for snapshots and inputs. */
  readonly snapshotCodec: SnapshotCodec<Snapshot>;
  readonly inputCodec: InputCodec<Input>;
}

/**
 * A snapshot in bytes. `previous` is the last snapshot the same receiver got
 * (null for the first, or after reconnecting), so only changes need to go:
 * the writer and the reader hold the same previous snapshot.
 */
export interface SnapshotCodec<Snapshot> {
  encode(snapshot: Snapshot, previous: Snapshot | null): Uint8Array;
  /** Throws on a frame it can't read. */
  decode(bytes: Uint8Array, previous: Snapshot | null): Snapshot;
}

export interface InputCodec<Input> {
  encode(input: Input): Uint8Array;
  /** Null for a frame that isn't a valid input (anything from a client is untrusted). */
  decode(bytes: Uint8Array): Input | null;
}

/**
 * A real-time bot (SPEC §9.5: steering with reaction delays and imperfect
 * aim per difficulty). The authority asks it for an input every few ticks,
 * inside the same world, so bots cost no messages.
 */
export interface ArenaBot<World, Input> {
  /** Ticks between decisions: its reaction time. */
  readonly thinkEvery: number;
  steer(world: World, id: number, context: ArenaBotContext): Input;
}

/** What a bot decides with. Its randomness comes from the world, so bots stay deterministic. */
export interface ArenaBotContext {
  rng: Rng;
}

/** What a realtime game's bots module exports: one bot per difficulty it declares. */
export type ArenaBots<World, Input> = Readonly<
  Partial<Record<BotDifficulty, ArenaBot<World, Input>>>
>;

/**
 * How many bots an arena should hold (SPEC §10.8): enough to reach the
 * minimum population with the people in it, never more than the room left.
 */
export function botsWanted(people: number, minimum: number, capacity: number): number {
  return Math.max(0, Math.min(minimum - people, capacity - people));
}
