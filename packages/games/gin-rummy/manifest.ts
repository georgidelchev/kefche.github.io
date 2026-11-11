import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.2 #13: Gin Rummy for two: knocking, gin and undercuts, to 100.
// Hands are secret, so online matches play on a table on the arena server
// (hiddenInformation, ADR-0047).
export const manifest = defineManifest({
  id: "gin-rummy",
  version: 1,
  category: "cards",
  kind: "turn",
  players: { min: 2, max: 2, default: 2 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 20, onExpiry: "random-move" },
    { kind: "per-move", seconds: 45, onExpiry: "random-move" },
  ],
  options: [
    {
      key: "target",
      label: "target",
      values: [
        { value: 100, label: "target100" },
        { value: 50, label: "target50" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: true,
  orientation: "any",
  controls: ["tap", "drag", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [10, 25],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "streak", icon: "flame", metric: "bestStreak", tiers: [3, 5, 10] },
  ],
  // Every draw and discard is a move, so a match replays exactly from its seed.
  scoreValidation: { kind: "replay" },
  tags: ["cards", "classic", "two-player", "rummy"],
});
