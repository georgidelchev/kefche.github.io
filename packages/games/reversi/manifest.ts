import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.4 #5: 8 × 8 for two players, with a move-hints toggle.
export const manifest = defineManifest({
  id: "reversi",
  version: 1,
  category: "board",
  kind: "turn",
  players: { min: 2, max: 2, default: 2 },
  // Public lobbies and quick match arrive in Phase 5 step 9.
  modes: ["solo-bots", "hotseat", "online-private"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 15, onExpiry: "random-move" },
    { kind: "per-move", seconds: 30, onExpiry: "random-move" },
    { kind: "per-move", seconds: 60, onExpiry: "random-move" },
    { kind: "clock", base: 180, increment: 2 },
    { kind: "clock", base: 300, increment: 0 },
  ],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [5, 15],
  leaderboards: [],
  achievements: [],
  // Every move is a square, so a match replays exactly (Phase 7 validation).
  scoreValidation: { kind: "replay" },
  tags: ["classic", "two-player", "strategy"],
});
