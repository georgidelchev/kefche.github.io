import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.3 #22: a safe first click, flags by long press or a mode toggle,
// chording; three levels.
export const manifest = defineManifest({
  id: "minesweeper",
  version: 1,
  category: "logic",
  kind: "race",
  players: { min: 1, max: 8, default: 1 },
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  timers: [
    { kind: "countdown", seconds: 300 },
    { kind: "countdown", seconds: 180 },
    { kind: "countdown", seconds: 900 },
  ],
  options: [
    {
      key: "level",
      label: "level",
      values: [
        { value: "beginner", label: "beginner" },
        { value: "intermediate", label: "intermediate" },
        { value: "expert", label: "expert" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard", "mouse"],
  renderer: "dom",
  estimatedMinutes: [1, 15],
  leaderboards: [
    { id: "best-time-beginner", metric: "time", order: "asc", when: { level: "beginner" } },
    { id: "best-time-intermediate", metric: "time", order: "asc", when: { level: "intermediate" } },
    { id: "best-time-expert", metric: "time", order: "asc", when: { level: "expert" } },
  ],
  achievements: [
    { id: "solver", icon: "target", metric: "wins", tiers: [1, 25, 100] },
    { id: "speed", icon: "timer", metric: "bestTime", tiers: [120_000, 40_000, 15_000] },
  ],
  // The mines come from the seed and the first reveal; every action is logged.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 15 },
  tags: ["puzzle", "classic", "single-player"],
});
