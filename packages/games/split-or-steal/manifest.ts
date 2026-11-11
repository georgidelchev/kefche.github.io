import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.4 #59: Split or Steal for 2–10 players, points only (never
// stakes): talk it over, then choose at once and in secret. Online matches
// play on a table on the arena server, which holds each choice until the
// pair has both chosen (hiddenInformation, ADR-0047). The talking is in
// the room's chat; the per-move time leaves room for it.
export const manifest = defineManifest({
  id: "split-or-steal",
  version: 1,
  category: "party",
  kind: "turn",
  players: { min: 2, max: 10, default: 4 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "per-move", seconds: 45, onExpiry: "random-move" },
    { kind: "none" },
    { kind: "per-move", seconds: 90, onExpiry: "random-move" },
  ],
  options: [
    {
      key: "rounds",
      label: "roundsOption",
      values: [
        { value: 3, label: "rounds3" },
        { value: 5, label: "rounds5" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: true,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [3, 10],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "veteran", icon: "medal", metric: "played", tiers: [10, 50, 200] },
  ],
  // Every choice is a move.
  scoreValidation: { kind: "replay" },
  tags: ["party", "social", "bluffing", "multiplayer"],
});
