import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.4 #52: Mafia for 5–12 players: secret roles (Mafia, Doctor,
// Detective, Villagers), night actions and day votes, with an automatic
// narrator. Roles and night choices are secret, so online matches play on
// a table on the arena server (hiddenInformation, ADR-0047). Bots act and
// vote from what's been revealed, and never talk.
export const manifest = defineManifest({
  id: "mafia",
  version: 1,
  category: "party",
  kind: "turn",
  players: { min: 5, max: 12, default: 8 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "per-move", seconds: 120, onExpiry: "random-move" },
    { kind: "none" },
    { kind: "per-move", seconds: 240, onExpiry: "random-move" },
  ],
  options: [],
  rated: false,
  hiddenInformation: true,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [10, 30],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "veteran", icon: "medal", metric: "played", tiers: [10, 50, 200] },
  ],
  // Roles come from the seed; every night choice and vote is a move.
  scoreValidation: { kind: "replay" },
  tags: ["party", "talk", "deduction", "multiplayer"],
});
