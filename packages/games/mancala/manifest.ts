import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.1 #10: Kalah rules, with 3–6 seeds a pit (4 by default).
export const manifest = defineManifest({
  id: "mancala",
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
  ],
  options: [
    {
      key: "seeds",
      label: "seeds",
      values: [
        { value: 4, label: "seeds4" },
        { value: 3, label: "seeds3" },
        { value: 5, label: "seeds5" },
        { value: 6, label: "seeds6" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [5, 10],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "streak", icon: "flame", metric: "bestStreak", tiers: [3, 5, 10] },
  ],
  // Every move is a pit, so a match replays exactly.
  scoreValidation: { kind: "replay" },
  tags: ["classic", "two-player", "strategy"],
});
