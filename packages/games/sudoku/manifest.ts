import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.3 #21: 1–8 players (race), generated puzzles with unique
// solutions, difficulty by solving techniques, notes, hints, errors toggle.
export const manifest = defineManifest({
  id: "sudoku",
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
  controls: ["tap", "keyboard"],
  renderer: "dom",
  offline: true,
  estimatedMinutes: [5, 40],
  leaderboards: [
    { id: "best-time-easy", metric: "time", order: "asc" },
    { id: "best-time-medium", metric: "time", order: "asc" },
    { id: "best-time-hard", metric: "time", order: "asc" },
    { id: "best-time-expert", metric: "time", order: "asc" },
  ],
  achievements: [],
  // The puzzle and every entry replay from the seed (Phase 7 validates submissions).
  scoreValidation: { kind: "replay" },
  tags: ["puzzle", "numbers", "single-player"],
});
