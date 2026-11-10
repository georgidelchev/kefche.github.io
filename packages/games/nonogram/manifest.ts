import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.3 #24: generated puzzles 5 × 5 to 15 × 15, each solvable by logic.
export const manifest = defineManifest({
  id: "nonogram",
  version: 1,
  category: "logic",
  kind: "race",
  players: { min: 1, max: 8, default: 1 },
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  timers: [
    { kind: "countdown", seconds: 600 },
    { kind: "countdown", seconds: 300 },
    { kind: "countdown", seconds: 1200 },
  ],
  options: [
    {
      key: "size",
      label: "size",
      values: [
        { value: 10, label: "size10" },
        { value: 5, label: "size5" },
        { value: 15, label: "size15" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [2, 20],
  leaderboards: [
    { id: "best-time-5", metric: "time", order: "asc", when: { size: 5 } },
    { id: "best-time-10", metric: "time", order: "asc", when: { size: 10 } },
    { id: "best-time-15", metric: "time", order: "asc", when: { size: 15 } },
  ],
  achievements: [
    { id: "solver", icon: "target", metric: "wins", tiers: [1, 25, 100] },
    { id: "speed", icon: "timer", metric: "bestTime", tiers: [600_000, 240_000, 120_000] },
  ],
  scoreValidation: { kind: "replay", maxActionsPerSecond: 15 },
  tags: ["puzzle", "logic", "single-player"],
});
