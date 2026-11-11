import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.2 #20: Durak, Podkidnoy, for 2–6 players, with transfers as an
// option. Hands and the deck are secret, so online matches play on a table
// on the arena server (hiddenInformation, ADR-0047).
export const manifest = defineManifest({
  id: "durak",
  version: 1,
  category: "cards",
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
      key: "transfer",
      label: "transfers",
      values: [
        { value: false, label: "transferOff" },
        { value: true, label: "transferOn" },
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
    { id: "survivor", icon: "trophy", metric: "wins", tiers: [1, 25, 100] },
    { id: "veteran", icon: "medal", metric: "played", tiers: [10, 50, 200] },
  ],
  // Every card and every pass is a move, so a match replays exactly from its seed.
  scoreValidation: { kind: "replay" },
  tags: ["cards", "classic", "party", "multiplayer"],
});
