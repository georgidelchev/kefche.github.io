import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.4 #85: gravity grid for 2–4 players; the board grows with players.
export const manifest = defineManifest({
  id: "four-in-a-row",
  version: 1,
  category: "board",
  kind: "turn",
  players: { min: 2, max: 4, default: 2 },
  // Public lobbies and quick match arrive in Phase 5 step 9.
  modes: ["solo-bots", "hotseat", "online-private"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 15, onExpiry: "random-move" },
    { kind: "per-move", seconds: 30, onExpiry: "random-move" },
    { kind: "per-move", seconds: 60, onExpiry: "random-move" },
  ],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [3, 10],
  leaderboards: [],
  achievements: [],
  // Every move is a column, so a match replays exactly (Phase 7 validation).
  scoreValidation: { kind: "replay" },
  tags: ["classic", "two-player", "multiplayer", "strategy"],
});
