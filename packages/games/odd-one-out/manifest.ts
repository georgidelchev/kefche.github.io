import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.8 #79: find the different symbol. Rings with a gap, one turned
// differently, in grids that grow; 45 seconds, levels cleared.
export const manifest = defineManifest({
  id: "odd-one-out",
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
  leaderboards: [{ id: "most-levels", metric: "score", order: "desc", device: true }],
  achievements: [
    { id: "played", icon: "repeat", metric: "played", tiers: [1, 25, 100] },
    { id: "spotter", icon: "compass", metric: "bestScore", tiers: [12, 18, 25] },
  ],
  // Every tap carries its cell and time; the engine applies the limits.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 12 },
  tags: ["speed", "focus", "visual", "single-player"],
});
