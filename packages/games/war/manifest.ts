import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.2 #16: War, quick, with an option to play itself. The piles are
// face down and the shuffles secret, so online matches play on a table on
// the arena server (hiddenInformation, ADR-0047).
export const manifest = defineManifest({
  id: "war",
  version: 1,
  category: "cards",
  kind: "turn",
  players: { min: 2, max: 2, default: 2 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  // No choices to make: one bot that flips.
  bots: { supported: true, difficulties: ["easy"], canFillSeats: true },
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 10, onExpiry: "random-move" },
    { kind: "per-move", seconds: 30, onExpiry: "random-move" },
  ],
  options: [
    {
      key: "battles",
      label: "battles",
      values: [
        { value: 100, label: "battles100" },
        { value: 300, label: "battles300" },
        { value: 0, label: "battlesEnd" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: true,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [3, 15],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "veteran", icon: "medal", metric: "played", tiers: [10, 50, 200] },
  ],
  // Every flip is a move, so a match replays exactly from its seed.
  scoreValidation: { kind: "replay" },
  tags: ["cards", "classic", "two-player"],
});
