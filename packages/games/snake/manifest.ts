import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.4 #32: classic grid snake, 1–8 players (race).
export const manifest = defineManifest({
  id: "snake",
  version: 1,
  category: "arcade",
  kind: "race",
  players: { min: 1, max: 8, default: 1 },
  // Race: everyone in a room plays the same seed (Phase 5 step 10).
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  // A race's time limit (the first is the default); solo play has none.
  timers: [
    { kind: "countdown", seconds: 300 },
    { kind: "countdown", seconds: 180 },
    { kind: "countdown", seconds: 600 },
  ],
  raceOptions: [
    {
      key: "speed",
      label: "speed",
      values: [
        { value: "normal", label: "normal" },
        { value: "slow", label: "slow" },
        { value: "fast", label: "fast" },
      ],
    },
    {
      key: "walls",
      label: "edges",
      values: [
        { value: true, label: "walls" },
        { value: false, label: "wrap" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["swipe", "keyboard", "tap"],
  renderer: "canvas",
  estimatedMinutes: [1, 10],
  leaderboards: [{ id: "best-score", metric: "score", order: "desc" }],
  achievements: [
    { id: "high-score", icon: "trophy", metric: "bestScore", tiers: [20, 60, 150] },
    { id: "dedicated", icon: "repeat", metric: "played", tiers: [10, 50, 200] },
  ],
  // Food comes from the seed and time is a stream of ticks, so a game replays
  // exactly from its inputs (Phase 7 validates submissions).
  scoreValidation: { kind: "replay", maxActionsPerSecond: 30 },
  tags: ["classic", "reflexes", "single-player"],
});
