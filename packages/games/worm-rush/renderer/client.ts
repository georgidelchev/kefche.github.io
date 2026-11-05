// The player's side of an arena: the connection's snapshots go into the
// clock and the buffer, the controls' steering into the connection and the
// prediction, and every animation frame draws the scene. What the HUD shows
// is kept in a small store, updated with each snapshot (15 a second).

import type { ArenaErrorCode } from "@kefche/game-sdk";
import {
  createArenaControls,
  INTERPOLATION_DELAY_MS,
  Predictor,
  ServerClock,
  SnapshotBuffer,
  type ArenaConnection,
  type ArenaControls,
  type ArenaHandlers,
  type ArenaStatus,
} from "@kefche/game-sdk/browser";

import {
  POSITION_SCALE,
  ARENA_RADIUS,
  TICKS_PER_SECOND,
  type Input,
  type Snapshot,
} from "../engine";
import { buildFrame, headOf, headPrediction } from "./frame";
import { createArenaScene, type ArenaScene } from "./scene";

/** How long a knockout stays in the feed. */
const FEED_MS = 5000;
const FEED_MAX = 3;

export interface FeedEntry {
  key: number;
  /** null: the edge. */
  by: string | null;
  victim: string;
  byYou: boolean;
  you: boolean;
  at: number;
}

export interface BoardRow {
  id: number;
  place: number;
  name: string;
  length: number;
  bot: boolean;
  you: boolean;
}

export interface HudState {
  status: ArenaStatus;
  error: ArenaErrorCode | null;
  /** Round trip in ms; null in the solo arena or before the first ping. */
  latency: number | null;
  /** A snapshot has arrived since joining. */
  joined: boolean;
  alive: boolean;
  length: number;
  place: number;
  of: number;
  board: BoardRow[];
  /** The player's own row when they're in play but not in the top 10. */
  you: BoardRow | null;
  feed: FeedEntry[];
  /** Where the player is, from −1 to 1 across the arena. */
  map: { x: number; y: number };
  /** The life that just ended, while out of play. */
  out: { by: string | null; best: number; kills: number; ms: number } | null;
}

export interface WormClientOptions {
  /** The element the arena fills; the scene and the touch controls go in it. */
  stage: HTMLElement;
  /** Opens the connection with these handlers (online, or the solo arena). */
  connect(handlers: ArenaHandlers<Snapshot>): ArenaConnection<Input>;
  /** The round trip is worth showing (online). */
  showLatency: boolean;
  actionLabel: string;
  actionIcon?: Node;
  reducedMotion?: boolean;
  /** The player started boosting (for its sound). */
  onBoost?: () => void;
}

export interface WormClient {
  readonly controls: ArenaControls;
  readonly connection: ArenaConnection<Input>;
  subscribe: (listener: () => void) => () => void;
  state: () => HudState;
  respawn(): void;
  /** Stops drawing and lets go of the controls (the player's pause). */
  pause(paused: boolean): void;
  destroy(): void;
}

const INITIAL: HudState = {
  status: "connecting",
  error: null,
  latency: null,
  joined: false,
  alive: false,
  length: 0,
  place: 0,
  of: 0,
  board: [],
  you: null,
  feed: [],
  map: { x: 0, y: 0 },
  out: null,
};

export async function createWormClient(options: WormClientOptions): Promise<WormClient> {
  const tickMs = 1000 / TICKS_PER_SECOND;
  const clock = new ServerClock(tickMs);
  const buffer = new SnapshotBuffer<Snapshot>();
  const predictor = new Predictor(headPrediction);
  const names = new Map<number, string>();
  const bots = new Set<number>();
  const listeners = new Set<() => void>();
  let scene: ArenaScene | null = await createArenaScene(
    options.stage,
    options.reducedMotion === undefined ? {} : { reducedMotion: options.reducedMotion },
  );
  let state = INITIAL;
  let latest: Snapshot | null = null;
  let self = 0;
  let feedKey = 0;
  let bornAt = 0;
  let wasAlive = false;
  let paused = false;
  let frameId = 0;
  let boosting = false;

  const publish = (next: Partial<HudState>) => {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  };

  const onSnapshot = (snapshot: Snapshot, tick: number, ack: number) => {
    const now = performance.now();
    clock.observe(tick, now);
    buffer.push(tick * tickMs, snapshot);
    latest = snapshot;
    const head = headOf(snapshot, self);
    if (head) predictor.correct(head, ack);
    else predictor.reset();

    for (const n of snapshot.names) {
      names.set(n.id, n.name);
      if (n.bot) bots.add(n.id);
      else bots.delete(n.id);
    }
    const name = (id: number) => names.get(id) ?? "";
    const me = snapshot.self;
    const board = snapshot.board.map((b, i) => ({
      id: b.id,
      place: i + 1,
      name: name(b.id),
      length: b.mass,
      bot: bots.has(b.id),
      you: b.id === self,
    }));
    const inBoard = board.some((b) => b.you);
    const feed = state.feed.filter((f) => now - f.at < FEED_MS);
    for (const k of snapshot.feed) {
      feed.push({
        key: ++feedKey,
        by: k.by === 0 ? null : name(k.by),
        victim: name(k.victim),
        byYou: k.by === self,
        you: k.victim === self,
        at: now,
      });
    }
    let out = state.out;
    if (me.alive && !wasAlive) {
      bornAt = now;
      out = null;
    } else if (!me.alive && wasAlive) {
      out = {
        by: me.by === 0 ? null : name(me.by),
        best: me.best,
        kills: me.kills,
        ms: now - bornAt,
      };
    }
    wasAlive = me.alive;
    publish({
      joined: true,
      alive: me.alive,
      length: me.mass,
      place: me.rank,
      of: me.of,
      board,
      you:
        me.alive && !inBoard
          ? { id: self, place: me.rank, name: name(self), length: me.mass, bot: false, you: true }
          : null,
      feed: feed.slice(-FEED_MAX),
      map: {
        x: me.x / POSITION_SCALE / ARENA_RADIUS,
        y: me.y / POSITION_SCALE / ARENA_RADIUS,
      },
      out,
      latency: options.showLatency ? connection.latency() : null,
    });
  };

  const connection = options.connect({
    onWelcome: (id) => {
      self = id;
      clock.reset();
      buffer.clear();
      predictor.reset();
    },
    onSnapshot,
    onStatus: (status, error) => {
      publish({ status, error: error ?? null });
    },
  });

  const controls = createArenaControls({
    stage: options.stage,
    actionLabel: options.actionLabel,
    ...(options.actionIcon ? { actionIcon: options.actionIcon } : {}),
    onChange: (steer) => {
      if (steer.action && !boosting) options.onBoost?.();
      boosting = steer.action;
      if (steer.heading === null) return;
      const input = { heading: steer.heading, boost: steer.action };
      const seq = connection.setInput(input);
      if (seq !== null) predictor.setInput(seq, input);
    },
  });

  let last = performance.now();
  let owed = 0;
  const draw = (now: number) => {
    frameId = requestAnimationFrame(draw);
    owed += now - last;
    last = now;
    // Prediction runs at the arena's tick rate, whatever the screen's.
    let ticks = 0;
    while (owed >= tickMs && ticks < 4) {
      predictor.tick();
      owed -= tickMs;
      ticks++;
    }
    if (ticks === 4) owed = 0;
    const server = clock.now(now);
    const bracket = server === null ? null : buffer.at(server - INTERPOLATION_DELAY_MS);
    if (bracket && latest && scene)
      scene.draw(buildFrame(bracket, latest, self, predictor.current()), now);
  };
  frameId = requestAnimationFrame(draw);

  return {
    controls,
    connection,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    state: () => state,
    respawn() {
      connection.respawn();
    },
    pause(next) {
      if (next === paused) return;
      paused = next;
      controls.release();
      if (paused) cancelAnimationFrame(frameId);
      else {
        last = performance.now();
        owed = 0;
        frameId = requestAnimationFrame(draw);
      }
    },
    destroy() {
      cancelAnimationFrame(frameId);
      connection.close();
      controls.dispose();
      scene?.dispose();
      scene = null;
      listeners.clear();
    },
  };
}
