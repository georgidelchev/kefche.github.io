import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.4 #57: Rock Paper Scissors Tournament, a knockout bracket of
// 2–16, best of three. Throws are made at once and in secret, so online
// matches play on a table on the arena server, which holds each throw until
// both are in (hiddenInformation, ADR-0047).
export const manifest = defineManifest({
  id: "rps-tournament",
  version: 1,
  category: "party",
  kind: "turn",
  players: { min: 2, max: 16, default: 8 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "per-move", seconds: 10, onExpiry: "random-move" },
    { kind: "none" },
    { kind: "per-move", seconds: 5, onExpiry: "random-move" },
  ],
  options: [
    {
      key: "bestOf",
      label: "bestOfOption",
      values: [
        { value: 3, label: "bestOf3" },
        { value: 5, label: "bestOf5" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: true,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [2, 8],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "veteran", icon: "medal", metric: "played", tiers: [10, 50, 200] },
  ],
  // The bracket comes from the seed; every throw is a move.
  scoreValidation: { kind: "replay" },
  tags: ["party", "quick", "classic", "multiplayer"],
});
