import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.3 #26: a solvable generator; 5 × 5 by default, 4 × 4 to 7 × 7.
export const manifest = defineManifest({
  id: "lights-off",
  version: 1,
  category: "logic",
  kind: "race",
  players: { min: 1, max: 8, default: 1 },
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
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
        { value: 5, label: "size5" },
        { value: 4, label: "size4" },
        { value: 6, label: "size6" },
        { value: 7, label: "size7" },
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
    { id: "best-time-4", metric: "time", order: "asc", when: { size: 4 } },
    { id: "best-time-5", metric: "time", order: "asc", when: { size: 5 } },
    { id: "best-time-6", metric: "time", order: "asc", when: { size: 6 } },
    { id: "best-time-7", metric: "time", order: "asc", when: { size: 7 } },
  ],
  achievements: [
    { id: "solver", icon: "target", metric: "wins", tiers: [1, 25, 100] },
    { id: "speed", icon: "timer", metric: "bestTime", tiers: [120_000, 45_000, 20_000] },
  ],
  scoreValidation: { kind: "replay", maxActionsPerSecond: 15 },
  tags: ["puzzle", "logic", "single-player"],
});
