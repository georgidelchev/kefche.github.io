import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.8 #76: tap 1 to 25 in a shuffled grid. The score is the time
// (plus a second for each wrong tap), lower being better.
export const manifest = defineManifest({
  id: "number-hunt",
  version: 1,
  category: "speed",
  kind: "race",
  players: { min: 1, max: 10, default: 2 },
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  timers: [{ kind: "countdown", seconds: 180 }],
  options: [],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard", "mouse"],
  renderer: "dom",
  estimatedMinutes: [1, 2],
  leaderboards: [{ id: "best-time", metric: "score", order: "asc", device: true, unit: "ms" }],
  achievements: [
    { id: "played", icon: "repeat", metric: "played", tiers: [1, 25, 100] },
    { id: "eagle-eye", icon: "timer", metric: "lowestScore", tiers: [30_000, 18_000, 12_000] },
  ],
  // Every tap carries its cell and time; the engine applies the limits.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 15 },
  tags: ["speed", "numbers", "focus", "single-player"],
});
