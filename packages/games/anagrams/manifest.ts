import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.7 #63: Anagrams. Seven letters, two minutes; words from them,
// checked against the language's dictionary (lexicons, ADR-0050). Offered
// only in its packs' languages (Phase 13 Q1: English and Bulgarian).
export const manifest = defineManifest({
  id: "anagrams",
  version: 1,
  category: "word",
  kind: "race",
  players: { min: 1, max: 8, default: 1 },
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  timers: [{ kind: "countdown", seconds: 180 }],
  options: [
    {
      key: "pack",
      label: "packOption",
      values: [
        { value: "en", label: "packEn", defaultIn: ["en"] },
        { value: "bg", label: "packBg", defaultIn: ["bg"] },
      ],
    },
  ],
  contentPacks: ["en", "bg"],
  lexicons: ["all", "common"],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [2, 3],
  leaderboards: [
    { id: "best-en", metric: "score", order: "desc", when: { pack: "en" } },
    { id: "best-bg", metric: "score", order: "desc", when: { pack: "bg" } },
  ],
  achievements: [
    { id: "played", icon: "repeat", metric: "played", tiers: [1, 25, 100] },
    { id: "wordsmith", icon: "star", metric: "bestScore", tiers: [40, 80, 140] },
  ],
  // The letters come from the seed; every word is checked in the replay.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 5 },
  tags: ["words", "puzzle", "quick", "single-player"],
});
