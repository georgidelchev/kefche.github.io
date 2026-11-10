import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.1 #7: the flying phase is an option, on by default.
export const manifest = defineManifest({
  id: "nine-mens-morris",
  version: 1,
  category: "board",
  kind: "turn",
  players: { min: 2, max: 2, default: 2 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 15, onExpiry: "random-move" },
    { kind: "per-move", seconds: 30, onExpiry: "random-move" },
    { kind: "per-move", seconds: 60, onExpiry: "random-move" },
    { kind: "clock", base: 180, increment: 2 },
    { kind: "clock", base: 300, increment: 0 },
  ],
  options: [
    {
      key: "flying",
      label: "flying",
      values: [
        { value: true, label: "flyingOn" },
        { value: false, label: "flyingOff" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [5, 15],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "streak", icon: "flame", metric: "bestStreak", tiers: [3, 5, 10] },
  ],
  // Every turn is a placement or move and its removal, so a match replays exactly.
  scoreValidation: { kind: "replay" },
  tags: ["classic", "two-player", "strategy"],
});
