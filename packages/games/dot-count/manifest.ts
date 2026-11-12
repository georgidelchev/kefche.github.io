import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.8 #78: estimate or count dots quickly. Ten rounds of dots shown
// for 1.2 s; points for how close each answer is.
export const manifest = defineManifest({
  id: "dot-count",
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
  estimatedMinutes: [1, 3],
  leaderboards: [{ id: "best-score", metric: "score", order: "desc" }],
  achievements: [
    { id: "played", icon: "repeat", metric: "played", tiers: [1, 25, 100] },
    { id: "sharp-eye", icon: "target", metric: "bestScore", tiers: [600, 780, 900] },
  ],
  // The dots come from the seed; each round's showing takes its time.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 5 },
  tags: ["speed", "numbers", "estimation", "single-player"],
});
