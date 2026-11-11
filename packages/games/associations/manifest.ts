import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.4 #55: Associations for 2–8 players: write the word you think
// everyone else will write, and score for every match. Answers are secret
// until all are in, so online matches play on a table on the arena server
// (hiddenInformation, ADR-0047). Prompts come from content packs, so the
// game is offered only in their languages (Q3: English and Bulgarian).
export const manifest = defineManifest({
  id: "associations",
  version: 1,
  category: "party",
  kind: "turn",
  players: { min: 2, max: 8, default: 4 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "per-move", seconds: 30, onExpiry: "random-move" },
    { kind: "none" },
    { kind: "per-move", seconds: 60, onExpiry: "random-move" },
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
      key: "rounds",
      label: "roundsOption",
      values: [
        { value: 5, label: "rounds5" },
        { value: 8, label: "rounds8" },
      ],
    },
  ],
  contentPacks: ["en", "bg"],
  rated: false,
  hiddenInformation: true,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [3, 8],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "veteran", icon: "medal", metric: "played", tiers: [10, 50, 200] },
  ],
  // The prompts come from the seed; every answer is a move.
  scoreValidation: { kind: "replay" },
  tags: ["party", "words", "quick", "multiplayer"],
});
