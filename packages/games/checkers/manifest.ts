import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.1 #2: International 10 × 10 and Russian 8 × 8, mandatory
// captures, multi-jumps and kings. Russian comes first (the default): 8 × 8
// suits a phone, and it's the one most played in Bulgaria.
export const manifest = defineManifest({
  id: "checkers",
  version: 1,
  category: "board",
  kind: "turn",
  players: { min: 2, max: 2, default: 2 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 15, onExpiry: "random-move" },
    { kind: "per-move", seconds: 30, onExpiry: "random-move" },
    { kind: "per-move", seconds: 60, onExpiry: "random-move" },
    { kind: "clock", base: 180, increment: 2 },
    { kind: "clock", base: 300, increment: 0 },
    { kind: "clock", base: 600, increment: 0 },
  ],
  options: [
    {
      key: "variant",
      label: "variant",
      values: [
        { value: "russian", label: "russian" },
        { value: "international", label: "international" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [5, 20],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "streak", icon: "flame", metric: "bestStreak", tiers: [3, 5, 10] },
  ],
  // Every move is its path of squares, so a match replays exactly (Phase 7 validation).
  scoreValidation: { kind: "replay" },
  tags: ["classic", "two-player", "strategy"],
});
