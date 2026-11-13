import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.7 #60: Hangman for 1 to 6 players, with themed word packs per
// language and a versus mode where players set words for each other. The
// word is secret, so online matches play on a table on the arena server
// (hiddenInformation, ADR-0047). Words come from content packs and the
// dictionary (lexicons, ADR-0050), so the game is offered only in their
// languages (Phase 13 Q1: English and Bulgarian).
export const manifest = defineManifest({
  id: "hangman",
  version: 1,
  category: "word",
  kind: "turn",
  players: { min: 1, max: 6, default: 1 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  // No clock by default on one device; online rooms start with 30 s a move.
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 30, onExpiry: "random-move" },
    { kind: "per-move", seconds: 60, onExpiry: "random-move" },
  ],
  onlineTimer: 1,
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
      key: "mode",
      label: "modeOption",
      values: [
        { value: "pack", label: "modePack" },
        { value: "versus", label: "modeVersus" },
      ],
    },
    {
      key: "rounds",
      label: "roundsOption",
      values: [
        { value: 5, label: "rounds5" },
        { value: 3, label: "rounds3" },
      ],
    },
  ],
  contentPacks: ["en", "bg"],
  lexicons: ["all", "blocked"],
  rated: false,
  hiddenInformation: true,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [2, 10],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "veteran", icon: "medal", metric: "played", tiers: [10, 50, 200] },
  ],
  // The pack words come from the seed; every letter and set word is a move.
  scoreValidation: { kind: "replay" },
  tags: ["words", "classic", "family", "multiplayer"],
});
