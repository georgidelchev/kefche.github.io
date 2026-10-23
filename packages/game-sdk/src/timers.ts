// Game timers (SPEC §11) as pure state: per-move countdowns, Fischer clocks
// and match countdowns. Elapsed time comes in as milliseconds from the
// runtime (or the host, online), and the state lives in the match, so every
// client shows the same clocks and a match replays exactly.

import type { TimerPreset } from "./manifest";

export interface TimerState {
  /** Milliseconds left per seat; a countdown has one shared entry. */
  readonly remainingMs: readonly number[];
}

export type ExpiryRule = "pass" | "random-move" | "loss" | "end";

const seconds = (s: number) => Math.round(s * 1000);
const slot = (preset: TimerPreset, seat: number) => (preset.kind === "countdown" ? 0 : seat);

function set(timers: TimerState, index: number, ms: number): TimerState {
  return { remainingMs: timers.remainingMs.map((v, i) => (i === index ? ms : v)) };
}

export function createTimers(preset: TimerPreset, seats: number): TimerState {
  switch (preset.kind) {
    case "none":
      return { remainingMs: [] };
    case "per-move":
      return { remainingMs: Array.from({ length: seats }, () => seconds(preset.seconds)) };
    case "clock":
      return { remainingMs: Array.from({ length: seats }, () => seconds(preset.base)) };
    case "countdown":
      return { remainingMs: [seconds(preset.seconds)] };
  }
}

/** A seat's turn begins: a per-move timer starts full again. */
export function startTurn(preset: TimerPreset, timers: TimerState, seat: number): TimerState {
  return preset.kind === "per-move" ? set(timers, seat, seconds(preset.seconds)) : timers;
}

/** Time passed while `seat` was to move. Never goes below zero. */
export function elapse(
  preset: TimerPreset,
  timers: TimerState,
  seat: number,
  ms: number,
): TimerState {
  if (preset.kind === "none" || ms <= 0) return timers;
  const index = slot(preset, seat);
  return set(timers, index, Math.max(0, (timers.remainingMs[index] ?? 0) - ms));
}

/** `seat` finished its move: a Fischer clock adds its increment. */
export function endTurn(preset: TimerPreset, timers: TimerState, seat: number): TimerState {
  if (preset.kind !== "clock" || preset.increment <= 0) return timers;
  return set(timers, seat, (timers.remainingMs[seat] ?? 0) + seconds(preset.increment));
}

/** Milliseconds left for `seat`, or null when the preset has no timer. */
export function timeLeft(preset: TimerPreset, timers: TimerState, seat: number): number | null {
  return preset.kind === "none" ? null : (timers.remainingMs[slot(preset, seat)] ?? 0);
}

export function isExpired(preset: TimerPreset, timers: TimerState, seat: number): boolean {
  const left = timeLeft(preset, timers, seat);
  return left !== null && left <= 0;
}

/** When the low-time warning starts (colour, sound and haptic in the HUD). */
export function lowTimeMs(preset: TimerPreset): number | null {
  switch (preset.kind) {
    case "none":
      return null;
    case "per-move":
      return Math.min(5000, seconds(preset.seconds) / 3);
    case "clock":
      return Math.min(20_000, Math.max(5000, seconds(preset.base) / 10));
    case "countdown":
      return 10_000;
  }
}

export function isLowTime(preset: TimerPreset, timers: TimerState, seat: number): boolean {
  const left = timeLeft(preset, timers, seat);
  const low = lowTimeMs(preset);
  return left !== null && low !== null && left > 0 && left <= low;
}

/** What happens when time runs out: the game's rule for per-move timers. */
export function expiryRule(preset: TimerPreset): ExpiryRule | null {
  switch (preset.kind) {
    case "none":
      return null;
    case "per-move":
      return preset.onExpiry;
    case "clock":
      return "loss";
    case "countdown":
      return "end";
  }
}
