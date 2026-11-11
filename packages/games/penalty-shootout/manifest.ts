import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.6 #93: Penalty Shootout for two (one against a bot): the shooter
// picks a spot and the keeper a dive, five kicks each, then sudden death.
// Choices are made at once and in secret, and a high shot can go over the
// bar, so online matches play on a table on the arena server
// (hiddenInformation, ADR-0047).
export const manifest = defineManifest({
  id: "penalty-shootout",
  version: 1,
  category: "sports",
  kind: "turn",
  players: { min: 2, max: 2, default: 2 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "per-move", seconds: 10, onExpiry: "random-move" },
    { kind: "none" },
    { kind: "per-move", seconds: 5, onExpiry: "random-move" },
  ],
  options: [],
  rated: false,
  hiddenInformation: true,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [1, 4],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "veteran", icon: "medal", metric: "played", tiers: [10, 50, 200] },
  ],
  // Every shot and dive is a move; the bar's misses come from the seed.
  scoreValidation: { kind: "replay" },
  tags: ["sports", "quick", "two-player", "multiplayer"],
});
