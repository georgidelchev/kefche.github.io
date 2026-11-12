// Odd One Out rules (SPEC §20.8 #79): a grid of rings, each with a gap
// (Landolt rings), all turned the same way except one. Find the odd one
// and tap it to clear the level; the next grid is bigger and its odd ring
// closer to the rest (from 180° apart on 3 × 3 down to 20° on 8 × 8).
// 45 seconds in all; a wrong tap costs 2 of them. The score is the levels
// cleared, higher being better.
//
// The odd ring differs only in which way it's turned, never in colour, so
// the game is the same for everyone who can see the grid.
//
// - The grids come from the seed (a race's are everyone's).
// - Each tap says which cell and when (ms after the first grid appeared,
//   as the player's device measured it). The first within 100 ms of the
//   grid, and any within 50 ms of the last, don't count (the speed kit's
//   limits); nor does any after the time has run out.
// - The run ends with a stop when the time, less the penalties, is up.
// - Every action returns the time since the last from `actionMs`.
// Pure and deterministic.
import { HUMAN, measuredMs, Rng, type GameResult, type RaceEngine } from "@kefche/game-sdk";

export const DURATION_MS = 45_000;
export const PENALTY_MS = 2000;
export const LEVELS = 60;

export type Action = { cell: number; ms: number } | { stop: true };

export interface Level {
  /** Rings a side. */
  size: number;
  /** Which way the rings' gaps face, in degrees. */
  angle: number;
  /** The odd ring's cell, and which way its gap faces. */
  odd: number;
  oddAngle: number;
}

export interface State {
  levels: Level[];
  /** Levels cleared: the one showing is levels[cleared]. */
  cleared: number;
  /** The latest action's time (ms after the first grid appeared). */
  last: number;
  mistakes: number;
  over: boolean;
}

/** A level's grid size and how far its odd ring is turned from the rest. */
function shape(level: number): { size: number; diff: number } {
  const size = Math.min(8, 3 + Math.floor(level / 3));
  const diffs = [180, 90, 90, 60, 60, 45, 45, 40, 35, 30, 30, 25];
  return { size, diff: diffs[level] ?? 20 };
}

export function initialState(_config: undefined, seed: string): State {
  const rng = Rng.fromSeed(`odd-one-out:${seed}`);
  const levels = Array.from({ length: LEVELS }, (_, k): Level => {
    const { size, diff } = shape(k);
    const angle = rng.int(0, 7) * 45;
    return {
      size,
      angle,
      odd: rng.int(0, size * size - 1),
      oddAngle: (angle + (rng.next() < 0.5 ? diff : 360 - diff)) % 360,
    };
  });
  return { levels, cleared: 0, last: 0, mistakes: 0, over: false };
}

/** When the time runs out, ms after the first grid appeared (penalties bring it closer). */
export const deadline = (s: State): number => DURATION_MS - s.mistakes * PENALTY_MS;

type Read = { tap: { cell: number; ms: number } } | { stop: true };

/** What an action is, checked as it arrived (a replayed log can hold anything). */
function read(s: State, action: unknown): Read | null {
  if (s.over || typeof action !== "object" || action === null) return null;
  if ("stop" in action) return (action as { stop?: unknown }).stop === true ? { stop: true } : null;
  const level = s.levels[s.cleared];
  if (!level) return null;
  const a = action as { cell?: unknown; ms?: unknown };
  const cell = measuredMs(a.cell, level.size * level.size - 1);
  const ms = measuredMs(a.ms, DURATION_MS);
  if (cell === null || ms === null || ms < s.last || ms >= deadline(s)) return null;
  const first = s.cleared === 0 && s.mistakes === 0;
  if (first ? ms < HUMAN.reactionMs : ms - s.last < HUMAN.tapGapMs) return null;
  return { tap: { cell, ms } };
}

function apply(s: State, action: Action): State {
  const r = read(s, action);
  if (!r) return s;
  if ("stop" in r) return { ...s, last: Math.max(s.last, deadline(s)), over: true };
  const level = s.levels[s.cleared];
  if (r.tap.cell === level?.odd) {
    const cleared = s.cleared + 1;
    return { ...s, cleared, last: r.tap.ms, over: cleared >= LEVELS };
  }
  return { ...s, mistakes: s.mistakes + 1, last: r.tap.ms };
}

function result(s: State): GameResult | null {
  // No winning here, only a score (like Snake and 2048).
  return s.over ? { completed: false, score: s.cleared } : null;
}

export const engine: RaceEngine<State, Action> = {
  initialState,
  apply,
  progress: (s) => (s.over ? 1 : Math.min(1, s.last / DURATION_MS)),
  result,
  score: (s) => s.cleared,
  actionMs: (s, action) => {
    const r = read(s, action);
    if (!r) return 0;
    return Math.max(0, ("stop" in r ? deadline(s) : r.tap.ms) - s.last);
  },
};
