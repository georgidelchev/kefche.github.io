import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.3 #25: 3 × 3 to 5 × 5 (4 × 4 by default); solo or a race.
export const manifest = defineManifest({
  id: "fifteen",
  version: 1,
  category: "logic",
  kind: "race",
  players: { min: 1, max: 8, default: 1 },
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  // A race's time limit (the first is the default).
  timers: [
    { kind: "countdown", seconds: 300 },
    { kind: "countdown", seconds: 180 },
    { kind: "countdown", seconds: 600 },
  ],
  options: [
    {
      key: "size",
      label: "size",
      values: [
        { value: 4, label: "size4" },
        { value: 3, label: "size3" },
        { value: 5, label: "size5" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [1, 10],
  leaderboards: [
    { id: "best-time-3", metric: "time", order: "asc", when: { size: 3 } },
    { id: "best-time-4", metric: "time", order: "asc", when: { size: 4 } },
    { id: "best-time-5", metric: "time", order: "asc", when: { size: 5 } },
  ],
  achievements: [
    { id: "solver", icon: "target", metric: "wins", tiers: [1, 25, 100] },
    // Best times in milliseconds: 3 minutes, 1 minute, 30 seconds.
    { id: "speed", icon: "timer", metric: "bestTime", tiers: [180_000, 60_000, 30_000] },
  ],
  // The start comes from the seed and every slide is logged.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 15 },
  tags: ["puzzle", "classic", "single-player"],
});
