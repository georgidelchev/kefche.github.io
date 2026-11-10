import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.3 #29: connect same-coloured dots and fill the board, 5 × 5 to
// 9 × 9 (6 × 6 by default), every puzzle with exactly one solution.
export const manifest = defineManifest({
  id: "pipe-link",
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
        { value: 6, label: "size6" },
        { value: 5, label: "size5" },
        { value: 7, label: "size7" },
        { value: 8, label: "size8" },
        { value: 9, label: "size9" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["drag", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [1, 10],
  leaderboards: [
    { id: "best-time-5", metric: "time", order: "asc", when: { size: 5 } },
    { id: "best-time-6", metric: "time", order: "asc", when: { size: 6 } },
    { id: "best-time-7", metric: "time", order: "asc", when: { size: 7 } },
    { id: "best-time-8", metric: "time", order: "asc", when: { size: 8 } },
    { id: "best-time-9", metric: "time", order: "asc", when: { size: 9 } },
  ],
  achievements: [
    { id: "solver", icon: "target", metric: "wins", tiers: [1, 25, 100] },
    { id: "speed", icon: "timer", metric: "bestTime", tiers: [120_000, 45_000, 20_000] },
  ],
  // The puzzle comes from the seed; each laid pipe is one logged action.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 10 },
  tags: ["puzzle", "logic", "single-player"],
});
