import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.4 #53: Who's the Spy for 3–10 players. Everyone but the spy
// knows the location; questions are asked in the room's chat, or aloud on
// one device. The roles are secret, so online matches play on a table on
// the arena server (hiddenInformation, ADR-0047). It's a game of talk, so
// there are no bots to play against (the table's stand-in for an absent
// player is the only one). Locations come from content packs, so the game
// is offered only in their languages (Q3: English and Bulgarian).
export const manifest = defineManifest({
  id: "whos-the-spy",
  version: 1,
  category: "party",
  kind: "turn",
  players: { min: 3, max: 10, default: 6 },
  modes: ["hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 300, onExpiry: "random-move" },
    { kind: "per-move", seconds: 180, onExpiry: "random-move" },
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
  ],
  contentPacks: ["en", "bg"],
  rated: false,
  hiddenInformation: true,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [5, 15],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "veteran", icon: "medal", metric: "played", tiers: [10, 50, 200] },
  ],
  // The location and the spy come from the seed; every vote is a move.
  scoreValidation: { kind: "replay" },
  tags: ["party", "talk", "deduction", "multiplayer"],
});
