import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.9 #89: the star board for 2–6 players (3 by default), jump chains.
export const manifest = defineManifest({
  id: "chinese-checkers",
  version: 1,
  category: "strategy",
  kind: "turn",
  players: { min: 2, max: 6, default: 3 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
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
  estimatedMinutes: [10, 30],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "streak", icon: "flame", metric: "bestStreak", tiers: [3, 5, 10] },
  ],
  // Every move is a hole and where it ends, so a match replays exactly.
  scoreValidation: { kind: "replay" },
  tags: ["classic", "multiplayer", "strategy"],
});
