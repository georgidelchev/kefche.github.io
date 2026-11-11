import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.2 #15: kefche's own shedding game in the Crazy Eights family,
// with its own deck and name. Hands are secret, so online matches play on a
// table on the arena server (hiddenInformation, ADR-0047).
export const manifest = defineManifest({
  id: "crazy-colors",
  version: 1,
  category: "cards",
  kind: "turn",
  players: { min: 2, max: 8, default: 4 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 15, onExpiry: "random-move" },
    { kind: "per-move", seconds: 30, onExpiry: "random-move" },
  ],
  options: [
    {
      key: "hand",
      label: "hand",
      values: [
        { value: 7, label: "hand7" },
        { value: 5, label: "hand5" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: true,
  orientation: "any",
  controls: ["tap", "drag", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [5, 15],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "streak", icon: "flame", metric: "bestStreak", tiers: [3, 5, 10] },
  ],
  // Every card played or drawn is a move, so a match replays exactly from its seed.
  scoreValidation: { kind: "replay" },
  tags: ["cards", "party", "multiplayer"],
});
