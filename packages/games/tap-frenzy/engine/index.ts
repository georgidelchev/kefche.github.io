// Tap Frenzy rules (SPEC §20.8 #72): as many taps as possible in 5
// seconds, from the first tap. The score is the taps that count.
//
// - Each tap says when it came, in milliseconds after the first (as the
//   player's device measured it); the run ends with a stop at 5000 ms.
// - A tap within 50 ms of the last one that counted doesn't count: that's
//   20 a second, beyond what fingers do (the speed kit's limit, Q6).
// - An autoclicker check: 20 or more counted taps spaced so evenly that
//   their gaps vary by under 3 ms (no human taps that steadily) make the
//   run void, with no score.
// - Taps and the stop return their gaps from `actionMs`, so the server
//   refuses a log claiming more time than passed since the play began.
// Pure and deterministic; no randomness.
import { HUMAN, mean, measuredMs, type GameResult, type RaceEngine } from "@kefche/game-sdk";

export const DURATION_MS = 5000;
/** Below this spread of gaps (ms, standard deviation) over at least STEADY_TAPS gaps, it's a machine. */
export const STEADY_SPREAD_MS = 3;
export const STEADY_TAPS = 20;

export type Action = { t: number } | { stop: true };

export interface State {
  /** When each counted tap came, in ms after the first. */
  taps: number[];
  /** The latest tap's time, counted or not. */
  last: number;
  /** Taps too soon after the one before. */
  ignored: number;
  over: boolean;
}

export const initialState = (): State => ({ taps: [], last: 0, ignored: 0, over: false });

/** The gaps between counted taps. */
export const gaps = (s: State): number[] => s.taps.slice(1).map((t, i) => t - (s.taps[i] ?? 0));

/** Whether the taps are too even to be a person's. */
export function machineLike(s: State): boolean {
  const g = gaps(s);
  if (g.length < STEADY_TAPS) return false;
  const m = mean(g);
  const spread = Math.sqrt(mean(g.map((x) => (x - m) ** 2)));
  return spread < STEADY_SPREAD_MS;
}

/** What an action is, checked as it arrived (a replayed log can hold anything). */
function read(s: State, action: unknown): { tap: number } | { stop: true } | null {
  if (s.over || typeof action !== "object" || action === null) return null;
  if ("stop" in action)
    return (action as { stop?: unknown }).stop === true && s.taps.length > 0
      ? { stop: true }
      : null;
  const t = measuredMs((action as { t?: unknown }).t, DURATION_MS);
  if (t === null) return null;
  // The first tap starts the clock at 0; taps never go back in time.
  if (s.taps.length === 0 ? t !== 0 : t < s.last) return null;
  return { tap: t };
}

function apply(s: State, action: Action): State {
  const read_ = read(s, action);
  if (!read_) return s;
  if ("stop" in read_) return { ...s, over: true };
  const t = read_.tap;
  const previous = s.taps.at(-1);
  if (previous !== undefined && t - previous < HUMAN.tapGapMs)
    return { ...s, last: t, ignored: s.ignored + 1 };
  return { ...s, taps: [...s.taps, t], last: t };
}

function result(s: State): GameResult | null {
  if (!s.over) return null;
  if (machineLike(s)) return { completed: false };
  return { completed: true, score: s.taps.length };
}

export const engine: RaceEngine<State, Action> = {
  initialState,
  apply,
  progress: (s) => (s.over ? 1 : Math.min(1, s.last / DURATION_MS)),
  result,
  actionMs: (s, action) => {
    const read_ = read(s, action);
    if (!read_) return 0;
    return ("stop" in read_ ? DURATION_MS : read_.tap) - s.last;
  },
};
