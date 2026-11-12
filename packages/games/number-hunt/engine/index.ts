// Number Hunt rules (SPEC §20.8 #76): the numbers 1 to 25 shuffled on a
// 5 × 5 grid (from the seed, so a race's grid is everyone's). Tap them in
// order, 1 to 25, as fast as possible. A wrong tap adds a second. The
// score is the time to the last number plus the penalties, in
// milliseconds, lower being better.
//
// - Each tap says which cell and when (ms after the grid appeared, as the
//   player's device measured it). The first within 100 ms of the grid
//   appearing doesn't count (no one finds a number that fast), nor does
//   any tap within 50 ms of the last (the speed kit's limits).
// - Every tap returns the time since the last from `actionMs`, so the
//   server refuses a log claiming more time than has passed.
// Pure and deterministic.
import { HUMAN, measuredMs, Rng, type GameResult, type RaceEngine } from "@kefche/game-sdk";

export const SIZE = 5;
export const COUNT = SIZE * SIZE;
export const PENALTY_MS = 1000;
/** The longest a game can run. */
export const MAX_MS = 10 * 60 * 1000;

export interface Action {
  cell: number;
  ms: number;
}

export interface State {
  /** The number in each cell, row by row. */
  grid: number[];
  /** The number to tap next (COUNT + 1 when done). */
  next: number;
  /** The latest tap's time, ms after the grid appeared. */
  last: number;
  mistakes: number;
}

export function initialState(_config: undefined, seed: string): State {
  const rng = Rng.fromSeed(`number-hunt:${seed}`);
  return {
    grid: rng.shuffle(Array.from({ length: COUNT }, (_, i) => i + 1)),
    next: 1,
    last: 0,
    mistakes: 0,
  };
}

export const isDone = (s: State): boolean => s.next > COUNT;

/** What a tap is, checked as it arrived (a replayed log can hold anything). */
function read(s: State, action: unknown): Action | null {
  if (isDone(s) || typeof action !== "object" || action === null) return null;
  const a = action as { cell?: unknown; ms?: unknown };
  const cell = measuredMs(a.cell, COUNT - 1);
  const ms = measuredMs(a.ms, MAX_MS);
  if (cell === null || ms === null || ms < s.last) return null;
  const first = s.next === 1 && s.mistakes === 0;
  if (first ? ms < HUMAN.reactionMs : ms - s.last < HUMAN.tapGapMs) return null;
  return { cell, ms };
}

function apply(s: State, action: Action): State {
  const r = read(s, action);
  if (!r) return s;
  if (s.grid[r.cell] === s.next) return { ...s, next: s.next + 1, last: r.ms };
  return { ...s, mistakes: s.mistakes + 1, last: r.ms };
}

/** The score: the time to the last number found, plus the penalties. */
export const score = (s: State): number => s.last + s.mistakes * PENALTY_MS;

function result(s: State): GameResult | null {
  // Finding all 25 is finishing the task, as solving a puzzle is.
  return isDone(s) ? { completed: true, score: score(s) } : null;
}

export const engine: RaceEngine<State, Action> = {
  initialState,
  apply,
  progress: (s) => (s.next - 1) / COUNT,
  result,
  actionMs: (s, action) => {
    const r = read(s, action);
    return r ? r.ms - s.last : 0;
  },
};
