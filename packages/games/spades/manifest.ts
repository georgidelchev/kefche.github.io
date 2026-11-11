import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.2 #14: Spades for four in two teams, with nil bids and bags.
// Hands are secret, so online matches play on a table on the arena server
// (hiddenInformation, ADR-0047).
export const manifest = defineManifest({
  id: "spades",
  version: 1,
  category: "cards",
  kind: "turn",
  players: { min: 4, max: 4, default: 4 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 20, onExpiry: "random-move" },
    { kind: "per-move", seconds: 45, onExpiry: "random-move" },
  ],
  options: [
    {
      key: "target",
      label: "target",
      values: [
        { value: 500, label: "target500" },
        { value: 300, label: "target300" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: true,
  orientation: "any",
  controls: ["tap", "drag", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [15, 30],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "veteran", icon: "medal", metric: "played", tiers: [10, 50, 200] },
  ],
  // Every bid and card is a move, so a match replays exactly from its seed.
  scoreValidation: { kind: "replay" },
  tags: ["cards", "classic", "teams", "tricks"],
});
