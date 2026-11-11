import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.2 #18: Spider Solitaire with 1, 2 or 4 suits, with undo. Alone,
// or a race online on the same deal.
export const manifest = defineManifest({
  id: "spider",
  version: 1,
  category: "cards",
  kind: "race",
  players: { min: 1, max: 8, default: 1 },
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  // A race's time limit (the first is the default).
  timers: [
    { kind: "countdown", seconds: 900 },
    { kind: "countdown", seconds: 600 },
    { kind: "countdown", seconds: 1200 },
  ],
  options: [
    {
      key: "suits",
      label: "suitsOption",
      values: [
        { value: 1, label: "suits1" },
        { value: 2, label: "suits2" },
        { value: 4, label: "suits4" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [5, 25],
  leaderboards: [
    { id: "best-time-1", metric: "time", order: "asc", when: { suits: 1 } },
    { id: "best-time-2", metric: "time", order: "asc", when: { suits: 2 } },
    { id: "best-time-4", metric: "time", order: "asc", when: { suits: 4 } },
  ],
  achievements: [
    { id: "solver", icon: "target", metric: "wins", tiers: [1, 25, 100] },
    // Best times in milliseconds: 15 minutes, 8 minutes, 4 minutes.
    { id: "speed", icon: "timer", metric: "bestTime", tiers: [900_000, 480_000, 240_000] },
  ],
  // The deal comes from the seed and every move is logged.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 12 },
  tags: ["cards", "puzzle", "classic", "single-player"],
});
