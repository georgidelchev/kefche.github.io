import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.2 #17: Klondike, draw 1 or 3, with undo, finishing by itself and
// winnable deals (from a bank a solver won). Alone, or a race online on the
// same deal.
export const manifest = defineManifest({
  id: "klondike",
  version: 1,
  category: "cards",
  kind: "race",
  players: { min: 1, max: 8, default: 1 },
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  // A race's time limit (the first is the default).
  timers: [
    { kind: "countdown", seconds: 600 },
    { kind: "countdown", seconds: 300 },
    { kind: "countdown", seconds: 900 },
  ],
  options: [
    {
      key: "draw",
      label: "drawOption",
      values: [
        { value: 1, label: "draw1" },
        { value: 3, label: "draw3" },
      ],
    },
    {
      key: "deal",
      label: "dealOption",
      values: [
        { value: "winnable", label: "winnable" },
        { value: "random", label: "anyDeal" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [3, 15],
  leaderboards: [
    { id: "best-time-1", metric: "time", order: "asc", when: { draw: 1, deal: "winnable" } },
    { id: "best-time-3", metric: "time", order: "asc", when: { draw: 3, deal: "winnable" } },
  ],
  achievements: [
    { id: "solver", icon: "target", metric: "wins", tiers: [1, 25, 100] },
    // Best times in milliseconds: 6 minutes, 3 minutes, 90 seconds.
    { id: "speed", icon: "timer", metric: "bestTime", tiers: [360_000, 180_000, 90_000] },
  ],
  // The deal comes from the seed and every move is logged.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 12 },
  tags: ["cards", "puzzle", "classic", "single-player"],
});
