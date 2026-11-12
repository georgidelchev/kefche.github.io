// The speed games' limits and arithmetic (Phase 13). Isomorphic: engines
// apply the same limits in the browser and in the server's replay, so a
// board never holds what no human could do (Q6).
//
// A speed game's actions carry the times the player's device measured
// (milliseconds, whole numbers). The engine checks each against these
// limits, and returns it from `actionMs`, so the server also refuses a log
// whose times add up to more than has passed since the play was issued.

export const HUMAN = {
  /**
   * The quickest reaction to a stimulus that counts: faster is a guess
   * made before it appeared (sprint starts use 100 ms too).
   */
  reactionMs: 100,
  /** Taps closer together than this (20 a second) don't count. */
  tapGapMs: 50,
} as const;

/** A time from the browser, if it's a whole number of milliseconds from 0 to `max`. */
export function measuredMs(raw: unknown, max: number): number | null {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= max ? raw : null;
}

/** Whether a reaction time counts (not a guess made before the stimulus). */
export const humanReaction = (ms: number): boolean => ms >= HUMAN.reactionMs;

export const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}
