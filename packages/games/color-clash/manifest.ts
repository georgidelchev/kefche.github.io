import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.8 #75: the Stroop test, pick the ink colour. Thirty seconds; a
// right pick scores, a wrong one costs a point.
export const manifest = defineManifest({
  id: "color-clash",
  version: 1,
  category: "speed",
  kind: "race",
  players: { min: 1, max: 10, default: 2 },
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  timers: [{ kind: "countdown", seconds: 90 }],
  options: [],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard", "mouse"],
  renderer: "dom",
  estimatedMinutes: [1, 2],
  leaderboards: [{ id: "best-score", metric: "score", order: "desc", device: true }],
  achievements: [
    { id: "played", icon: "repeat", metric: "played", tiers: [1, 25, 100] },
    { id: "focus", icon: "star", metric: "bestScore", tiers: [20, 32, 45] },
  ],
  // Every pick carries its time; the engine applies the limits.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 12 },
  tags: ["speed", "brain", "colours", "single-player"],
});
