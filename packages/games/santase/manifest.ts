import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.2 #12: Santase, Bulgarian Sixty-Six: marriages, swapping the
// nine of trumps, closing the stock, and a game to 11. The hand and the
// stock are secret, so online matches play on a table on
// the arena server (hiddenInformation, ADR-0047).
export const manifest = defineManifest({
  id: "santase",
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
  rated: false,
  hiddenInformation: true,
  orientation: "any",
  controls: ["tap", "drag", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [10, 20],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "streak", icon: "flame", metric: "bestStreak", tiers: [3, 5, 10] },
  ],
  // Every call and card is a move, so a match replays exactly from its seed.
  scoreValidation: { kind: "replay" },
  tags: ["cards", "classic", "two-player", "tricks"],
});
