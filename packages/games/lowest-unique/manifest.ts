import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.4 #58: Lowest Unique Number for 2–10 players, in rounds. Picks
// are made at once and in secret, so online matches play on a table on the
// arena server, which holds each pick until everyone has picked
// (hiddenInformation, ADR-0047).
export const manifest = defineManifest({
  id: "lowest-unique",
  version: 1,
  category: "party",
  kind: "turn",
  players: { min: 2, max: 10, default: 5 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "per-move", seconds: 15, onExpiry: "random-move" },
    { kind: "none" },
    { kind: "per-move", seconds: 30, onExpiry: "random-move" },
  ],
  options: [
    {
      key: "rounds",
      label: "roundsOption",
      values: [
        { value: 5, label: "rounds5" },
        { value: 10, label: "rounds10" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: true,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [2, 6],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "veteran", icon: "medal", metric: "played", tiers: [10, 50, 200] },
  ],
  // Every pick is a move.
  scoreValidation: { kind: "replay" },
  tags: ["party", "numbers", "quick", "multiplayer"],
});
