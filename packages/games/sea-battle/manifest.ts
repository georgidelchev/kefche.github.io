import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.1 #5: Sea Battle, the pencil-and-paper game for two: a 10 × 10
// grid and a fleet of 5, 4, 3, 3 and 2. Each fleet is secret, so online
// matches play on a table on the arena server (hiddenInformation,
// ADR-0047).
export const manifest = defineManifest({
  id: "sea-battle",
  version: 1,
  category: "board",
  kind: "turn",
  players: { min: 2, max: 2, default: 2 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 15, onExpiry: "random-move" },
    { kind: "per-move", seconds: 45, onExpiry: "random-move" },
  ],
  options: [
    {
      key: "again",
      label: "againOption",
      values: [
        { value: false, label: "againOff" },
        { value: true, label: "againOn" },
      ],
    },
  ],
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
  // Every ship placed and every shot is a move, so a match replays exactly.
  scoreValidation: { kind: "replay" },
  tags: ["classic", "two-player", "pencil-and-paper", "strategy"],
});
