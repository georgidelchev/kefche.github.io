import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.9 #88: an original polyomino territory game for 2–4 players (4 by
// default), with the shared row of pieces of owner decision Q3.
export const manifest = defineManifest({
  id: "shape-claim",
  version: 1,
  category: "strategy",
  kind: "turn",
  players: { min: 2, max: 4, default: 4 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 30, onExpiry: "random-move" },
    { kind: "per-move", seconds: 60, onExpiry: "random-move" },
  ],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [10, 25],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "streak", icon: "flame", metric: "bestStreak", tiers: [3, 5, 10] },
  ],
  // Every move is the cells a piece covers; the bag comes from the seed.
  scoreValidation: { kind: "replay" },
  tags: ["multiplayer", "strategy", "original"],
});
