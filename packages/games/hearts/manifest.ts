import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.2 #19: Hearts for four, with passing and shooting the moon.
// Hands are secret, so online matches play on a table on the arena server
// (hiddenInformation, ADR-0047).
export const manifest = defineManifest({
  id: "hearts",
  version: 1,
  category: "cards",
  kind: "turn",
  players: { min: 4, max: 4, default: 4 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 20, onExpiry: "random-move" },
    { kind: "per-move", seconds: 45, onExpiry: "random-move" },
  ],
  options: [
    {
      key: "target",
      label: "target",
      values: [
        { value: 100, label: "target100" },
        { value: 50, label: "target50" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: true,
  orientation: "any",
  controls: ["tap", "drag", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [10, 25],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "veteran", icon: "medal", metric: "played", tiers: [10, 50, 200] },
  ],
  // Every pass and card is a move, so a match replays exactly from its seed.
  scoreValidation: { kind: "replay" },
  tags: ["cards", "classic", "four-player", "tricks"],
});
