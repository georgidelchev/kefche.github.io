import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.1 #4: Ludo for 2–4 players, with bots to fill seats. The die
// must not be known in advance, so online matches play on a table on the
// arena server, which rolls it (hiddenInformation, ADR-0047).
export const manifest = defineManifest({
  id: "ludo",
  version: 1,
  category: "board",
  kind: "turn",
  players: { min: 2, max: 4, default: 4 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 15, onExpiry: "random-move" },
    { kind: "per-move", seconds: 30, onExpiry: "random-move" },
  ],
  options: [
    {
      key: "tokens",
      label: "tokensOption",
      values: [
        { value: 4, label: "tokens4" },
        { value: 2, label: "tokens2" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: true,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [10, 30],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "veteran", icon: "medal", metric: "played", tiers: [10, 50, 200] },
  ],
  // Every roll comes from the seed and every move is logged.
  scoreValidation: { kind: "replay" },
  tags: ["dice", "classic", "family", "multiplayer"],
});
