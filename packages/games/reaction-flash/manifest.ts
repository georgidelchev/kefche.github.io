import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.8 #71: tap when green; false-start rules. Five rounds, scored
// by the average reaction, measured on the player's device.
export const manifest = defineManifest({
  id: "reaction-flash",
  version: 1,
  category: "speed",
  kind: "race",
  players: { min: 1, max: 10, default: 2 },
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  timers: [{ kind: "countdown", seconds: 120 }],
  options: [],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard", "mouse"],
  renderer: "dom",
  estimatedMinutes: [1, 2],
  leaderboards: [{ id: "best-average", metric: "score", order: "asc", device: true, unit: "ms" }],
  achievements: [
    { id: "played", icon: "repeat", metric: "played", tiers: [1, 25, 100] },
    { id: "quick", icon: "flame", metric: "lowestScore", tiers: [350, 280, 230] },
  ],
  // Every press carries its measured time; the engine applies the limits.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 10 },
  tags: ["speed", "reflex", "single-player", "quick"],
});
