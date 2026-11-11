import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.3 #30: find the pairs, 12, 20 or 30 cards. Alone it's a race
// against the clock (fewest flips and time) and online a race on the same
// layout. Playing together (on one device, or against bots) is in the
// game's own menu, and records nothing. Taking turns online, with the
// layout hidden on the server (SPEC §10.6), is Memory Pairs: a turn game on
// the same cards (Phase 12, which resolved TODO #5).
export const manifest = defineManifest({
  id: "memory-match",
  version: 1,
  category: "logic",
  kind: "race",
  players: { min: 1, max: 8, default: 1 },
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  timers: [
    { kind: "countdown", seconds: 180 },
    { kind: "countdown", seconds: 90 },
    { kind: "countdown", seconds: 300 },
  ],
  options: [
    {
      key: "cards",
      label: "cards",
      values: [
        { value: 20, label: "cards20" },
        { value: 12, label: "cards12" },
        { value: 30, label: "cards30" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [1, 5],
  leaderboards: [
    { id: "best-time-12", metric: "time", order: "asc", when: { cards: 12 } },
    { id: "best-time-20", metric: "time", order: "asc", when: { cards: 20 } },
    { id: "best-time-30", metric: "time", order: "asc", when: { cards: 30 } },
  ],
  achievements: [
    { id: "solver", icon: "target", metric: "wins", tiers: [1, 25, 100] },
    { id: "speed", icon: "timer", metric: "bestTime", tiers: [90_000, 45_000, 25_000] },
  ],
  // The layout comes from the seed; every flip is logged.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 8 },
  tags: ["puzzle", "memory", "classic", "multiplayer"],
});
