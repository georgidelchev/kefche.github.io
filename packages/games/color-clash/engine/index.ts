// Color Clash rules (SPEC §20.8 #75): the Stroop test. A colour's name is
// shown printed in an ink colour, usually a different one ("RED" in
// blue); pick the colour of the ink, not the word. 30 seconds: a right
// pick scores a point, a wrong one takes a point away (never below zero).
// The score is the points, higher being better.
//
// - The words and inks come from the seed (a race's are everyone's): four
//   colours, red, blue, green and yellow; a quarter of the time the word
//   and its ink agree.
// - Each pick says when it came (ms after the first word appeared, as the
//   player's device measured it). A pick within 100 ms of its word
//   appearing doesn't count at all: no one reads and answers that fast
//   (the speed kit's limit). The run ends with a stop at 30 s.
// - Every action returns the time since the last from `actionMs`.
// Pure and deterministic.
import { HUMAN, measuredMs, Rng, type GameResult, type RaceEngine } from "@kefche/game-sdk";

export const COLOURS = ["red", "blue", "green", "yellow"] as const;
export type Colour = (typeof COLOURS)[number];
export const DURATION_MS = 30_000;
/** More words than anyone answers in 30 s. */
export const TRIALS = 300;

export interface Trial {
  /** The colour the word names. */
  word: number;
  /** The colour it's printed in: the answer. */
  ink: number;
}

export type Action = { pick: number; ms: number } | { stop: true };

export interface State {
  trials: Trial[];
  /** The word showing now. */
  index: number;
  /** When it appeared (ms after the first), and the latest action's time. */
  shownAt: number;
  last: number;
  right: number;
  wrong: number;
  points: number;
  over: boolean;
}

export function initialState(_config: undefined, seed: string): State {
  const rng = Rng.fromSeed(`color-clash:${seed}`);
  const n = COLOURS.length;
  const trials: Trial[] = [];
  for (let i = 0; i < TRIALS; i++) {
    const ink = rng.int(0, n - 1);
    // A quarter agree; otherwise any other colour's name.
    const word = rng.next() < 0.25 ? ink : (ink + rng.int(1, n - 1)) % n;
    trials.push({ word, ink });
  }
  return { trials, index: 0, shownAt: 0, last: 0, right: 0, wrong: 0, points: 0, over: false };
}

type Read = { pick: number; ms: number } | { stop: true };

/** What an action is, checked as it arrived (a replayed log can hold anything). */
function read(s: State, action: unknown): Read | null {
  if (s.over || typeof action !== "object" || action === null) return null;
  if ("stop" in action) return (action as { stop?: unknown }).stop === true ? { stop: true } : null;
  const a = action as { pick?: unknown; ms?: unknown };
  const pick = measuredMs(a.pick, COLOURS.length - 1);
  const ms = measuredMs(a.ms, DURATION_MS);
  if (pick === null || ms === null || ms < s.last) return null;
  if (ms - s.shownAt < HUMAN.reactionMs || s.index >= TRIALS) return null;
  return { pick, ms };
}

function apply(s: State, action: Action): State {
  const r = read(s, action);
  if (!r) return s;
  if ("stop" in r) return { ...s, last: DURATION_MS, over: true };
  const trial = s.trials[s.index];
  if (!trial) return s;
  const right = r.pick === trial.ink;
  return {
    ...s,
    index: s.index + 1,
    shownAt: r.ms,
    last: r.ms,
    right: s.right + (right ? 1 : 0),
    wrong: s.wrong + (right ? 0 : 1),
    points: right ? s.points + 1 : Math.max(0, s.points - 1),
  };
}

function result(s: State): GameResult | null {
  // No winning here, only a score (like Snake and 2048).
  return s.over ? { completed: false, score: s.points } : null;
}

export const engine: RaceEngine<State, Action> = {
  initialState,
  apply,
  progress: (s) => (s.over ? 1 : s.last / DURATION_MS),
  result,
  score: (s) => s.points,
  actionMs: (s, action) => {
    const r = read(s, action);
    if (!r) return 0;
    return ("stop" in r ? DURATION_MS : r.ms) - s.last;
  },
};
