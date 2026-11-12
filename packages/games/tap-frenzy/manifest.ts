import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.8 #72: taps in 5 s, with an autoclicker check: taps closer than
// 50 ms don't count, and machine-even tapping voids the run.
export const manifest = defineManifest({
  id: "tap-frenzy",
  version: 1,
  category: "speed",
  kind: "race",
  players: { min: 1, max: 10, default: 2 },
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  timers: [{ kind: "countdown", seconds: 60 }],
  options: [],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard", "mouse"],
  renderer: "dom",
  estimatedMinutes: [1, 2],
  leaderboards: [{ id: "most-taps", metric: "score", order: "desc", device: true }],
  achievements: [
    { id: "played", icon: "repeat", metric: "played", tiers: [1, 25, 100] },
    { id: "fast-fingers", icon: "flame", metric: "bestScore", tiers: [35, 50, 65] },
  ],
  // Every tap carries its time; the engine applies the limits.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 25 },
  tags: ["speed", "reflex", "single-player", "quick"],
});
