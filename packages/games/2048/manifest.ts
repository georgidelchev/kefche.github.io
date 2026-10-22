import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.3 #23: 1–8 players (race), undo once per game in solo.
export const manifest = defineManifest({
  id: "2048",
  version: 1,
  category: "logic",
  kind: "race",
  players: { min: 1, max: 8, default: 1 },
  // Race mode (same seed for everyone) arrives with multiplayer in Phase 5.
  modes: ["solo"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  timers: [{ kind: "none" }],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["swipe", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [3, 20],
  leaderboards: [{ id: "best-score", metric: "score", order: "desc" }],
  achievements: [],
  // Every move is replayable from the seed (Phase 7 validates submissions).
  scoreValidation: { kind: "replay" },
  tags: ["puzzle", "numbers", "single-player"],
});
