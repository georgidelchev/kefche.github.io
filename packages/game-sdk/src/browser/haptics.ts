// Haptics (SPEC §16): short vibrations for key events where the device
// supports them and the player hasn't turned them off.

export const HAPTICS = {
  tap: 10,
  hit: 30,
  win: [40, 60, 40],
  lose: [80, 40, 120],
} as const satisfies Record<string, number | readonly number[]>;

export function vibrate(pattern: number | readonly number[], enabled = true): void {
  if (!enabled || typeof navigator.vibrate !== "function") return;
  navigator.vibrate(typeof pattern === "number" ? pattern : [...pattern]);
}
