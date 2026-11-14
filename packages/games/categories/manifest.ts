import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.7 #67: Categories for 2 to 10 players, a letter and six
// categories answered at the same time, with the room voting on doubtful
// answers. Sheets and votes are secret until all are in, so online matches
// play on a table on the arena server (hiddenInformation, ADR-0047). The
// known answers come from content packs and the blocklist from the word
// lists (lexicons, ADR-0050), so the game is offered only in their
// languages (Phase 13 Q1: English and Bulgarian).
export const manifest = defineManifest({
  id: "categories",
  version: 1,
  category: "word",
  kind: "turn",
  players: { min: 2, max: 10, default: 4 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  // No clock by default on one device, where players answer in turn; online
  // rooms start with 90 s to answer and to vote. A clock running out sends
  // what's been typed.
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 90, onExpiry: "random-move" },
    { kind: "per-move", seconds: 60, onExpiry: "random-move" },
    { kind: "per-move", seconds: 120, onExpiry: "random-move" },
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
      key: "rounds",
      label: "roundsOption",
      values: [
        { value: 3, label: "rounds3" },
        { value: 5, label: "rounds5" },
      ],
    },
  ],
  contentPacks: ["en", "bg"],
  lexicons: ["all", "blocked"],
  rated: false,
  hiddenInformation: true,
  orientation: "any",
  controls: ["keyboard", "tap"],
  renderer: "dom",
  estimatedMinutes: [4, 12],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "veteran", icon: "medal", metric: "played", tiers: [10, 50, 200] },
  ],
  // The categories and letters come from the seed; every sheet and ballot is a move.
  scoreValidation: { kind: "replay" },
  tags: ["words", "party", "family", "multiplayer"],
});
