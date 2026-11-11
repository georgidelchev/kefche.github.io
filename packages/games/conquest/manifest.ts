import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.6 #83: Conquest, an original game of territory on kefche's own
// map for 2–6 players, with bots. The dice must not be known in advance, so
// online matches play on a table on the arena server, which rolls them
// (hiddenInformation, ADR-0047).
export const manifest = defineManifest({
  id: "conquest",
  version: 1,
  category: "strategy",
  kind: "turn",
  players: { min: 2, max: 6, default: 4 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 20, onExpiry: "random-move" },
    { kind: "per-move", seconds: 45, onExpiry: "random-move" },
  ],
  options: [
    {
      key: "goal",
      label: "goalOption",
      values: [
        { value: "most", label: "goalMost" },
        { value: "all", label: "goalAll" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: true,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [15, 45],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "veteran", icon: "medal", metric: "played", tiers: [10, 50, 200] },
  ],
  // Every roll comes from the seed and every move is logged.
  scoreValidation: { kind: "replay" },
  tags: ["dice", "strategy", "original", "multiplayer"],
});
