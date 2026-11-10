import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.3 #27: 3–8 discs (4 by default); solo or a race.
export const manifest = defineManifest({
  id: "hanoi",
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
      key: "discs",
      label: "discs",
      values: [
        { value: 4, label: "discs4" },
        { value: 3, label: "discs3" },
        { value: 5, label: "discs5" },
        { value: 6, label: "discs6" },
        { value: 7, label: "discs7" },
        { value: 8, label: "discs8" },
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
    { id: "best-time-5", metric: "time", order: "asc", when: { discs: 5 } },
    { id: "best-time-6", metric: "time", order: "asc", when: { discs: 6 } },
    { id: "best-time-7", metric: "time", order: "asc", when: { discs: 7 } },
    { id: "best-time-8", metric: "time", order: "asc", when: { discs: 8 } },
  ],
  achievements: [
    { id: "solver", icon: "target", metric: "wins", tiers: [1, 25, 100] },
    { id: "speed", icon: "timer", metric: "bestTime", tiers: [120_000, 45_000, 20_000] },
  ],
  scoreValidation: { kind: "replay", maxActionsPerSecond: 12 },
  tags: ["puzzle", "classic", "single-player"],
});
