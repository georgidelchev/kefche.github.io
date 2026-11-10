import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.9 #90: Ultimate Tic-Tac-Toe, with classic tic-tac-toe as a mode.
export const manifest = defineManifest({
  id: "ultimate-ttt",
  version: 1,
  category: "strategy",
  kind: "turn",
  players: { min: 2, max: 2, default: 2 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 15, onExpiry: "random-move" },
    { kind: "per-move", seconds: 30, onExpiry: "random-move" },
    { kind: "clock", base: 180, increment: 2 },
  ],
  options: [
    {
      key: "mode",
      label: "mode",
      values: [
        { value: "ultimate", label: "modeUltimate" },
        { value: "classic", label: "modeClassic" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [3, 15],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "streak", icon: "flame", metric: "bestStreak", tiers: [3, 5, 10] },
  ],
  // Every move is a cell, so a match replays exactly.
  scoreValidation: { kind: "replay" },
  tags: ["classic", "two-player", "quick"],
});
