import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.4 #82: 2–5 players; the grid grows with the number of players.
export const manifest = defineManifest({
  id: "dots-and-boxes",
  version: 1,
  category: "board",
  kind: "turn",
  players: { min: 2, max: 5, default: 2 },
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
  estimatedMinutes: [3, 15],
  leaderboards: [],
  achievements: [],
  // Every move is a line, so a match replays exactly (Phase 7 validation).
  scoreValidation: { kind: "replay" },
  tags: ["classic", "pencil-and-paper", "multiplayer", "strategy"],
});
