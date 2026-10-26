import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.3 #21: 1–8 players (race), generated puzzles with unique
// solutions, difficulty by solving techniques, notes, hints, errors toggle.
export const manifest = defineManifest({
  id: "sudoku",
  version: 1,
  category: "logic",
  kind: "race",
  players: { min: 1, max: 8, default: 1 },
  // Race: everyone in a room solves the same puzzle (Phase 5 step 10).
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  // A race's time limit (the first is the default); solo play has none.
  timers: [
    { kind: "countdown", seconds: 1200 },
    { kind: "countdown", seconds: 600 },
    { kind: "countdown", seconds: 1800 },
    { kind: "countdown", seconds: 2700 },
  ],
  raceOptions: [
    {
      key: "difficulty",
      label: "difficulty",
      values: [
        { value: "medium", label: "medium" },
        { value: "easy", label: "easy" },
        { value: "hard", label: "hard" },
        { value: "expert", label: "expert" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [5, 40],
  leaderboards: [
    { id: "best-time-easy", metric: "time", order: "asc", when: { difficulty: "easy" } },
    { id: "best-time-medium", metric: "time", order: "asc", when: { difficulty: "medium" } },
    { id: "best-time-hard", metric: "time", order: "asc", when: { difficulty: "hard" } },
    { id: "best-time-expert", metric: "time", order: "asc", when: { difficulty: "expert" } },
  ],
  achievements: [
    { id: "solver", icon: "target", metric: "wins", tiers: [1, 25, 100] },
    // Best times in milliseconds: 10, 5 and 3 minutes.
    { id: "speed", icon: "timer", metric: "bestTime", tiers: [600_000, 300_000, 180_000] },
  ],
  // The puzzle and every entry replay from the seed (Phase 7 validates submissions).
  scoreValidation: { kind: "replay", maxActionsPerSecond: 15 },
  tags: ["puzzle", "numbers", "single-player"],
});
