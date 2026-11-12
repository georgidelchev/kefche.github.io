// Sequence Memory rules (SPEC §20.8 #77): four pads. The game plays a
// sequence, lighting one pad after another; repeat it by pressing the pads
// in the same order. Each time you do, the sequence grows by one more step
// (the steps come from the seed, so a race's sequences are everyone's). A
// wrong pad ends the game. The score is the longest sequence repeated.
//
// - Showing a sequence of n steps takes n × the step time, which shortens
//   as the sequence grows (600 ms down to 350 ms: under three flashes a
//   second, WCAG 2.3.1). The first press of each round returns that
//   showing time from `actionMs`, so the server refuses a log claiming a
//   long run sooner than its sequences could have been shown.
// Pure and deterministic.
import { measuredMs, Rng, type GameResult, type RaceEngine } from "@kefche/game-sdk";

export const PADS = 4;
/** Longer than anyone's memory. */
export const MAX_LENGTH = 500;

export interface Action {
  pad: number;
}

export interface State {
  /** Every step the sequence will have. */
  steps: number[];
  /** The sequence's length this round. */
  length: number;
  /** How many of this round's steps the player has repeated. */
  pos: number;
  /** The wrong pad pressed, once the game is over. */
  missed: number | null;
}

export function initialState(_config: undefined, seed: string): State {
  const rng = Rng.fromSeed(`sequence-memory:${seed}`);
  return {
    steps: Array.from({ length: MAX_LENGTH }, () => rng.int(0, PADS - 1)),
    length: 1,
    pos: 0,
    missed: null,
  };
}

/** One step's time while showing a sequence of `length` steps. */
export const stepMs = (length: number): number => Math.max(350, 600 - 20 * (length - 1));

/** How long showing a sequence of `length` steps takes. */
export const showMs = (length: number): number => length * stepMs(length);

export const isOver = (s: State): boolean => s.missed !== null || s.length > MAX_LENGTH;

function read(s: State, action: unknown): number | null {
  if (isOver(s) || typeof action !== "object" || action === null) return null;
  return measuredMs((action as { pad?: unknown }).pad, PADS - 1);
}

function apply(s: State, action: Action): State {
  const pad = read(s, action);
  if (pad === null) return s;
  if (pad !== s.steps[s.pos]) return { ...s, missed: pad };
  return s.pos + 1 === s.length ? { ...s, length: s.length + 1, pos: 0 } : { ...s, pos: s.pos + 1 };
}

/** The longest sequence repeated. */
export const score = (s: State): number => s.length - 1;

function result(s: State): GameResult | null {
  // No winning here, only a score (like Snake and 2048).
  return isOver(s) ? { completed: false, score: score(s) } : null;
}

export const engine: RaceEngine<State, Action> = {
  initialState,
  apply,
  progress: (s) => Math.min(1, score(s) / 20),
  result,
  score,
  // The round's first press comes after its sequence was shown.
  actionMs: (s, action) => (read(s, action) !== null && s.pos === 0 ? showMs(s.length) : 0),
};
