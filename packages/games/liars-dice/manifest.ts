import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.4 #56: Liar's Dice for 2–6 players, bluffing for points only (no
// stakes). Every cup is secret, so online matches play on a table on the
// arena server, which rolls the dice (hiddenInformation, ADR-0047).
export const manifest = defineManifest({
  id: "liars-dice",
  version: 1,
  category: "party",
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
      key: "wild",
      label: "wildOption",
      values: [
        { value: true, label: "wildOn" },
        { value: false, label: "wildOff" },
      ],
    },
    {
      key: "exact",
      label: "exactOption",
      values: [
        { value: true, label: "exactOn" },
        { value: false, label: "exactOff" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: true,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [5, 20],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "veteran", icon: "medal", metric: "played", tiers: [10, 50, 200] },
  ],
  // Every roll comes from the seed and every bid and call is logged.
  scoreValidation: { kind: "replay" },
  tags: ["dice", "bluffing", "party", "multiplayer"],
});
