import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.3 #23: 1–8 players (race), undo once per game in solo.
export const manifest = defineManifest({
  id: "2048",
  version: 1,
  category: "logic",
  kind: "race",
  players: { min: 1, max: 8, default: 1 },
  // Race: everyone in a room plays the same seed (Phase 5 step 10).
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  // A race's time limit (the first is the default); solo play has none.
  timers: [
    { kind: "countdown", seconds: 300 },
    { kind: "countdown", seconds: 180 },
    { kind: "countdown", seconds: 600 },
  ],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["swipe", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [3, 20],
  leaderboards: [{ id: "best-score", metric: "score", order: "desc" }],
  achievements: [],
  // Every move is replayable from the seed (Phase 7 validates submissions).
  scoreValidation: { kind: "replay", maxActionsPerSecond: 20 },
  tags: ["puzzle", "numbers", "single-player"],
});
