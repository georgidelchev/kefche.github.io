// Aim Trainer rules (SPEC §20.8 #73): 20 targets, one at a time, each at a
// place on a square board (from the seed, so a race's targets are
// everyone's). A target shrinks from its full size to nothing over 1.5 s;
// hit it before it's gone. A hit scores up to 100 points by how much of
// the target was left, so quick hits score more; clicks that miss lower
// the accuracy shown at the end. The score is the points, higher better.
//
// - The board is 1000 × 1000 units. Each click says where it landed, in
//   units, and how long after its target appeared (as the player's device
//   measured it); the engine works out the target's size at that moment,
//   so the server's replay judges every hit the same way.
// - A hit within 100 ms of the target appearing is a miss: no one sees,
//   aims and clicks that fast (the speed kit's limit, Q6).
// - A target the player doesn't hit ends with an expiry at 1.5 s.
// - Every action returns the time since the last from `actionMs`, so the
//   server refuses a log claiming more time than has passed.
// Pure and deterministic.
import { HUMAN, measuredMs, Rng, type GameResult, type RaceEngine } from "@kefche/game-sdk";

export const TARGETS = 20;
export const BOARD = 1000;
/** A target's radius when it appears, in board units. */
export const RADIUS = 90;
/** How long a target lasts, shrinking to nothing. */
export const LIFE_MS = 1500;
/** Extra reach around a target for a finger's imprecision, in board units. */
export const SLOP = 8;
export const MAX_POINTS = 100;

export type Action = { x: number; y: number; ms: number } | { expire: true };

export interface Target {
  x: number;
  y: number;
}

export interface State {
  targets: Target[];
  /** The target on the board now (TARGETS once all are done). */
  index: number;
  /** The latest action's time on the current target, in ms after it appeared. */
  lastMs: number;
  /** Each target's outcome: its hit's time and points, or null if it got away. */
  hits: ({ ms: number; points: number } | null)[];
  /** Every click, and those that missed. */
  clicks: number;
  misses: number;
}

export function initialState(_config: undefined, seed: string): State {
  const rng = Rng.fromSeed(`aim-trainer:${seed}`);
  const targets: Target[] = [];
  for (let i = 0; i < TARGETS; i++) {
    // Far enough from the last one that every target means a move.
    let t: Target;
    do {
      t = { x: rng.int(RADIUS, BOARD - RADIUS), y: rng.int(RADIUS, BOARD - RADIUS) };
    } while (
      targets.length > 0 &&
      Math.hypot(t.x - (targets.at(-1)?.x ?? 0), t.y - (targets.at(-1)?.y ?? 0)) < 2 * RADIUS
    );
    targets.push(t);
  }
  return { targets, index: 0, lastMs: 0, hits: [], clicks: 0, misses: 0 };
}

export const isOver = (s: State): boolean => s.index >= TARGETS;

/** A target's radius `ms` after it appeared. */
export const radiusAt = (ms: number): number => RADIUS * Math.max(0, 1 - ms / LIFE_MS);

/** Points for a hit `ms` after its target appeared. */
export const pointsAt = (ms: number): number =>
  Math.max(1, Math.round((MAX_POINTS * radiusAt(ms)) / RADIUS));

type Read = { click: { x: number; y: number; ms: number } } | { expire: true };

/** What an action is, checked as it arrived (a replayed log can hold anything). */
function read(s: State, action: unknown): Read | null {
  if (isOver(s) || typeof action !== "object" || action === null) return null;
  if ("expire" in action)
    return (action as { expire?: unknown }).expire === true ? { expire: true } : null;
  const a = action as { x?: unknown; y?: unknown; ms?: unknown };
  const x = measuredMs(a.x, BOARD);
  const y = measuredMs(a.y, BOARD);
  const ms = measuredMs(a.ms, LIFE_MS);
  if (x === null || y === null || ms === null || ms < s.lastMs) return null;
  return { click: { x, y, ms } };
}

const next = (s: State, hit: { ms: number; points: number } | null): State => ({
  ...s,
  index: s.index + 1,
  lastMs: 0,
  hits: [...s.hits, hit],
});

function apply(s: State, action: Action): State {
  const r = read(s, action);
  if (!r) return s;
  if ("expire" in r) return next(s, null);
  const { x, y, ms } = r.click;
  const target = s.targets[s.index];
  if (!target) return s;
  const onTarget =
    ms >= HUMAN.reactionMs && Math.hypot(x - target.x, y - target.y) <= radiusAt(ms) + SLOP;
  const clicked = { ...s, clicks: s.clicks + 1 };
  if (!onTarget) return { ...clicked, misses: s.misses + 1, lastMs: ms };
  return next(clicked, { ms, points: pointsAt(ms) });
}

export const score = (s: State): number => s.hits.reduce((n, h) => n + (h?.points ?? 0), 0);

/** Hits as a share of clicks (1 before the first click). */
export const accuracy = (s: State): number =>
  s.clicks === 0 ? 1 : (s.clicks - s.misses) / s.clicks;

function result(s: State): GameResult | null {
  return isOver(s) ? { completed: true, score: score(s) } : null;
}

export const engine: RaceEngine<State, Action> = {
  initialState,
  apply,
  progress: (s) => s.index / TARGETS,
  result,
  score,
  actionMs: (s, action) => {
    const r = read(s, action);
    if (!r) return 0;
    return ("expire" in r ? LIFE_MS : r.click.ms) - s.lastMs;
  },
};
