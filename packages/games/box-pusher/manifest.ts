import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.3 #28: push every box onto a goal. 20 fixed levels per
// difficulty, picked in the game's menu, and fresh levels from the seed for
// races and the daily challenge.
export const manifest = defineManifest({
  id: "box-pusher",
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
      key: "difficulty",
      label: "difficulty",
      values: [
        { value: "easy", label: "easy" },
        { value: "medium", label: "medium" },
        { value: "hard", label: "hard" },
      ],
    },
    {
      key: "level",
      label: "level",
      // 0: a fresh level; 1–20: the fixed levels, picked only in the game's menu.
      values: Array.from({ length: 21 }, (_, i) => ({
        value: i,
        label: i === 0 ? "freshLevel" : "fixedLevel",
      })),
      rooms: false,
    },
  ],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["keyboard", "swipe", "tap"],
  renderer: "dom",
  estimatedMinutes: [1, 10],
  leaderboards: [
    { id: "best-time-easy", metric: "time", order: "asc", when: { difficulty: "easy", level: 0 } },
    {
      id: "best-time-medium",
      metric: "time",
      order: "asc",
      when: { difficulty: "medium", level: 0 },
    },
    { id: "best-time-hard", metric: "time", order: "asc", when: { difficulty: "hard", level: 0 } },
  ],
  achievements: [
    { id: "solver", icon: "target", metric: "wins", tiers: [1, 25, 100] },
    { id: "speed", icon: "timer", metric: "bestTime", tiers: [120_000, 45_000, 20_000] },
  ],
  // The level comes from the config and the seed; every step is logged.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 15 },
  tags: ["puzzle", "logic", "single-player"],
});
