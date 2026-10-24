import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.1 #1. The clocks are SPEC §11's (base and increment in seconds).
// Bots are Stockfish (renderer/bots.worker.ts). Online, a player who leaves
// keeps losing time (SPEC §10.5), so rooms always play with a clock. Rated
// pools arrive with rated games.
export const manifest = defineManifest({
  id: "chess",
  version: 1,
  category: "board",
  kind: "turn",
  players: { min: 2, max: 2, default: 2 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: {
    supported: true,
    difficulties: ["easy", "medium", "hard"],
    canFillSeats: true,
    // Stockfish's Skill Level, for players who want to pick it themselves.
    levels: { min: 0, max: 20 },
  },
  timers: [
    { kind: "none" },
    { kind: "clock", base: 60, increment: 0 },
    { kind: "clock", base: 120, increment: 1 },
    { kind: "clock", base: 180, increment: 0 },
    { kind: "clock", base: 180, increment: 2 },
    { kind: "clock", base: 300, increment: 0 },
    { kind: "clock", base: 300, increment: 3 },
    { kind: "clock", base: 600, increment: 0 },
    { kind: "clock", base: 600, increment: 5 },
    { kind: "clock", base: 900, increment: 10 },
    { kind: "clock", base: 1800, increment: 0 },
  ],
  awayPlayers: "clock",
  // Rooms start with 10 + 0.
  onlineTimer: 7,
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "drag", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [5, 60],
  leaderboards: [],
  achievements: [],
  // Moves are UCI strings, so a game replays exactly (the server's check of rated games).
  scoreValidation: { kind: "replay" },
  tags: ["classic", "two-player", "strategy"],
});
