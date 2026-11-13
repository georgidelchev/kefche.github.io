import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.7 #69: Word Chain for 2 to 8 players, each word starting with
// the last letter of the one before, checked against the language's
// dictionary (lexicons, ADR-0050). Nothing is secret, so online the room's
// host runs the match. Offered in the dictionaries' languages (Phase 13 Q1:
// English and Bulgarian).
export const manifest = defineManifest({
  id: "word-chain",
  version: 1,
  category: "word",
  kind: "turn",
  players: { min: 2, max: 8, default: 2 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  // No clock by default on one device; online rooms start with 30 s a move.
  // A clock running out passes, which costs a life.
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 30, onExpiry: "random-move" },
    { kind: "per-move", seconds: 15, onExpiry: "random-move" },
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
  ],
  contentPacks: ["en", "bg"],
  lexicons: ["all", "common", "blocked"],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["keyboard", "tap"],
  renderer: "dom",
  estimatedMinutes: [3, 12],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "veteran", icon: "medal", metric: "played", tiers: [10, 50, 200] },
  ],
  // Every word and pass is a move, checked against the dictionary on replay.
  scoreValidation: { kind: "replay" },
  tags: ["words", "family", "multiplayer"],
});
