// Black Keys rules (SPEC §20.8 #74; an original name and look): rows of
// four tiles scroll down the board, each row with one black tile (its
// column from the seed). Tap the black tile of each row, in order, before
// it scrolls off the bottom. Tapping a white tile, a row out of order, or
// letting a black tile go ends the game. The rows scroll faster and
// faster; the score is the black tiles tapped.
//
// - The board shows four rows. Row k fills [k, k + 1) in rows from the
//   bottom of the track, and the board shows [y, y + 4), where y, the
//   scroll, is a fixed function of the time since the first tap: it starts
//   at 2.5 rows a second and gains 0.08 rows a second every second.
// - Each tap says which tile it hit and when (ms after the first tap, as
//   the player's device measured it), so the engine knows what was on the
//   board then: a tap on a row that wasn't showing doesn't count.
// - The renderer reports a miss when the next row's black tile has gone
//   off the bottom (y ≥ k + 1); the engine checks the time it claims.
// - Taps within 50 ms of the last don't count (the speed kit's limit).
// - Every action returns the time since the last from `actionMs`.
// Pure and deterministic.
import { HUMAN, measuredMs, Rng, type GameResult, type RaceEngine } from "@kefche/game-sdk";

export const COLUMNS = 4;
export const VISIBLE_ROWS = 4;
/** Rows a game can have: far more than anyone reaches (about 15 minutes). */
export const MAX_ROWS = 4000;
/** Rows a second at the start, and how much faster each second. */
export const START_SPEED = 2.5;
export const SPEED_GAIN = 0.08;
/** The longest a game can run, in ms. */
export const MAX_MS = 15 * 60 * 1000;

export type Action = { row: number; col: number; ms: number } | { miss: number };

export interface State {
  /** The black tile's column in each row. */
  cols: number[];
  /** Black tiles tapped: the next row to tap. */
  played: number;
  /** The latest action's time, ms after the first tap. */
  last: number;
  over: null | { why: "wrong"; row: number; col: number } | { why: "missed"; row: number };
}

export function initialState(_config: undefined, seed: string): State {
  const rng = Rng.fromSeed(`black-keys:${seed}`);
  return {
    cols: Array.from({ length: MAX_ROWS }, () => rng.int(0, COLUMNS - 1)),
    played: 0,
    last: 0,
    over: null,
  };
}

/** The scroll, in rows, `ms` after the first tap. */
export function scrollAt(ms: number): number {
  const t = ms / 1000;
  return START_SPEED * t + (SPEED_GAIN * t * t) / 2;
}

/** Whether row `row` shows on the board `ms` after the first tap. */
export const showing = (row: number, ms: number): boolean => {
  const y = scrollAt(ms);
  return y < row + 1 && row < y + VISIBLE_ROWS;
};

type Read = { tap: { row: number; col: number; ms: number } } | { miss: number };

/** What an action is, checked as it arrived (a replayed log can hold anything). */
function read(s: State, action: unknown): Read | null {
  if (s.over !== null || s.played >= MAX_ROWS || typeof action !== "object" || action === null)
    return null;
  if ("miss" in action) {
    const ms = measuredMs((action as { miss?: unknown }).miss, MAX_MS);
    // Only when the next black tile really has gone off the bottom by then.
    return ms !== null && ms >= s.last && s.played > 0 && scrollAt(ms) >= s.played + 1
      ? { miss: ms }
      : null;
  }
  const a = action as { row?: unknown; col?: unknown; ms?: unknown };
  const row = measuredMs(a.row, MAX_ROWS - 1);
  const col = measuredMs(a.col, COLUMNS - 1);
  const ms = measuredMs(a.ms, MAX_MS);
  if (row === null || col === null || ms === null || ms < s.last) return null;
  // The first tap starts the clock: it's row 0's, at 0 ms.
  if (s.played === 0 && (ms !== 0 || row !== 0)) return null;
  if (s.played > 0 && ms - s.last < HUMAN.tapGapMs) return null;
  // Rows already tapped, and rows not on the board then, can't be tapped.
  if (row < s.played || !showing(row, ms)) return null;
  return { tap: { row, col, ms } };
}

function apply(s: State, action: Action): State {
  const r = read(s, action);
  if (!r) return s;
  if ("miss" in r) return { ...s, last: r.miss, over: { why: "missed", row: s.played } };
  const { row, col, ms } = r.tap;
  if (row === s.played && col === s.cols[row]) return { ...s, played: s.played + 1, last: ms };
  return { ...s, last: ms, over: { why: "wrong", row, col } };
}

function result(s: State): GameResult | null {
  if (s.over === null && s.played < MAX_ROWS) return null;
  // No winning here, only a score (like Snake and 2048).
  return { completed: false, score: s.played };
}

export const engine: RaceEngine<State, Action> = {
  initialState,
  apply,
  // No end in sight: progress grows with the rows, slowly.
  progress: (s) => Math.min(1, s.played / 200),
  result,
  score: (s) => s.played,
  actionMs: (s, action) => {
    const r = read(s, action);
    if (!r) return 0;
    return ("miss" in r ? r.miss : r.tap.ms) - s.last;
  },
};
