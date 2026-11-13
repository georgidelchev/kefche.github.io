import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.7 #65: themed word search grids per language. Words in eight
// directions; three sizes, each with a best-time board. The themes come
// from content packs, so the game is offered only in their languages
// (Phase 13 Q1: English and Bulgarian).
export const manifest = defineManifest({
  id: "word-search",
  version: 1,
  category: "word",
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
      key: "pack",
      label: "packOption",
      values: [
        { value: "en", label: "packEn", defaultIn: ["en"] },
        { value: "bg", label: "packBg", defaultIn: ["bg"] },
      ],
    },
    {
      key: "size",
      label: "size",
      values: [
        { value: 10, label: "size10" },
        { value: 8, label: "size8" },
        { value: 12, label: "size12" },
      ],
    },
  ],
  contentPacks: ["en", "bg"],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard", "mouse"],
  renderer: "dom",
  estimatedMinutes: [2, 8],
  leaderboards: [
    { id: "best-time-8", metric: "time", order: "asc", when: { size: 8 } },
    { id: "best-time-10", metric: "time", order: "asc", when: { size: 10 } },
    { id: "best-time-12", metric: "time", order: "asc", when: { size: 12 } },
  ],
  achievements: [
    { id: "finder", icon: "target", metric: "wins", tiers: [1, 25, 100] },
    { id: "speed", icon: "timer", metric: "bestTime", tiers: [180_000, 90_000, 45_000] },
  ],
  // The grid comes from the seed; every selection is logged.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 6 },
  tags: ["words", "puzzle", "classic", "single-player"],
});
