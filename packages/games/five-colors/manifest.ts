import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.9 #86: 2–5 players (3 by default) on a large grid: five in a row
// for two players, four in a row from three (engine/index.ts says why).
export const manifest = defineManifest({
  id: "five-colors",
  version: 1,
  category: "strategy",
  kind: "turn",
  players: { min: 2, max: 5, default: 3 },
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
  estimatedMinutes: [5, 15],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "streak", icon: "flame", metric: "bestStreak", tiers: [3, 5, 10] },
  ],
  // Every move is a point, so a match replays exactly.
  scoreValidation: { kind: "replay" },
  tags: ["multiplayer", "strategy", "party"],
});
