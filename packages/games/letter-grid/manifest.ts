import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.7 #66: find words in a 4 × 4 or 5 × 5 letter grid (an original
// name). Words are checked against the language's dictionary (lexicons,
// ADR-0050), so the game is offered only in English and Bulgarian (Q1).
export const manifest = defineManifest({
  id: "letter-grid",
  version: 1,
  category: "word",
  kind: "race",
  players: { min: 1, max: 8, default: 1 },
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  timers: [{ kind: "countdown", seconds: 240 }],
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
        { value: 4, label: "size4" },
        { value: 5, label: "size5" },
      ],
    },
  ],
  contentPacks: ["en", "bg"],
  lexicons: ["all", "common"],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard", "mouse"],
  renderer: "dom",
  estimatedMinutes: [3, 4],
  leaderboards: [
    { id: "best-4", metric: "score", order: "desc", when: { size: 4 } },
    { id: "best-5", metric: "score", order: "desc", when: { size: 5 } },
  ],
  achievements: [
    { id: "played", icon: "repeat", metric: "played", tiers: [1, 25, 100] },
    { id: "explorer", icon: "compass", metric: "bestScore", tiers: [25, 50, 90] },
  ],
  // The grid comes from the seed; every word is traced in the replay.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 5 },
  tags: ["words", "puzzle", "single-player"],
});
