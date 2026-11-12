// Reaction Flash rules (SPEC §20.8 #71): five rounds. In each, the screen
// waits a random 1.5 to 4 seconds (from the seed, so a race's rounds are
// everyone's), then turns green; press as soon as it does. The score is
// the average of the five reactions in milliseconds, lower being better.
//
// - Each press says how long after its round began it came, as the
//   player's device measured it. The engine knows the round's wait, so it
//   decides what the press was: before the green, or within 100 ms of it
//   (no human reacts that fast: a guess), it's a false start, and the round
//   is played again with a new wait; otherwise its reaction counts, up to
//   1.5 s (the renderer presses for a player who hasn't by then).
// - Three false starts end the game without a score.
// - Every press's time is returned from `actionMs`, so the server refuses a
//   log claiming more time than has passed since its play was issued.
// Pure and deterministic.
import { HUMAN, mean, measuredMs, Rng, type GameResult, type RaceEngine } from "@kefche/game-sdk";

export const ROUNDS = 5;
export const MAX_FALSE_STARTS = 3;
export const MIN_WAIT_MS = 1500;
export const MAX_WAIT_MS = 4000;
/** The slowest reaction that counts as itself; a press is made for the player then. */
export const SLOW_MS = 1500;

export interface Action {
  /** Milliseconds from the round's start (its "wait" screen drawn) to the press. */
  ms: number;
}

export interface State {
  /** The wait before each try's green: one per round and per possible false start. */
  waits: number[];
  /** Tries so far (rounds counted and false starts). */
  tries: number;
  /** The rounds' reactions in milliseconds, in order. */
  times: number[];
  falseStarts: number;
}

export function initialState(_config: undefined, seed: string): State {
  const rng = Rng.fromSeed(`reaction-flash:${seed}`);
  return {
    waits: Array.from({ length: ROUNDS + MAX_FALSE_STARTS }, () =>
      rng.int(MIN_WAIT_MS, MAX_WAIT_MS),
    ),
    tries: 0,
    times: [],
    falseStarts: 0,
  };
}

export const isOver = (s: State): boolean =>
  s.times.length >= ROUNDS || s.falseStarts >= MAX_FALSE_STARTS;

/** The wait before the current try's green, or null once the game is over. */
export const currentWait = (s: State): number | null =>
  isOver(s) ? null : (s.waits[s.tries] ?? null);

/** What a press `ms` after the round began would be: a false start, or a reaction. */
export function judge(wait: number, ms: number): { falseStart: true } | { reaction: number } {
  const reaction = ms - wait;
  return reaction < HUMAN.reactionMs ? { falseStart: true } : { reaction };
}

function apply(s: State, action: Action): State {
  const wait = currentWait(s);
  if (wait === null) return s;
  const ms = measuredMs((action as { ms?: unknown } | null)?.ms, wait + SLOW_MS);
  if (ms === null) return s;
  const verdict = judge(wait, ms);
  if ("falseStart" in verdict) return { ...s, tries: s.tries + 1, falseStarts: s.falseStarts + 1 };
  return { ...s, tries: s.tries + 1, times: [...s.times, verdict.reaction] };
}

/** The average reaction so far, rounded, or null before the first. */
export const average = (s: State): number | null =>
  s.times.length === 0 ? null : Math.round(mean(s.times));

function result(s: State): GameResult | null {
  if (!isOver(s)) return null;
  if (s.times.length < ROUNDS) return { completed: false };
  // No winning here, only a score (like Snake and 2048: "Game over", not "You won").
  return { completed: false, score: average(s) ?? 0 };
}

export const engine: RaceEngine<State, Action> = {
  initialState,
  apply,
  progress: (s) => s.times.length / ROUNDS,
  result,
  actionMs: (s, action) => {
    const wait = currentWait(s);
    if (wait === null) return 0;
    return measuredMs((action as { ms?: unknown } | null)?.ms, wait + SLOW_MS) ?? 0;
  },
};
