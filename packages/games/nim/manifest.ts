import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.9 #87: 2–5 players, the classic piles or seeded ones, and the
// misère option.
export const manifest = defineManifest({
  id: "nim",
  version: 1,
  category: "strategy",
  kind: "turn",
  players: { min: 2, max: 5, default: 2 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 15, onExpiry: "random-move" },
    { kind: "per-move", seconds: 30, onExpiry: "random-move" },
  ],
  options: [
    {
      key: "piles",
      label: "piles",
      values: [
        { value: "classic", label: "pilesClassic" },
        { value: "random", label: "pilesRandom" },
      ],
    },
    {
      key: "misere",
      label: "lastStick",
      values: [
        { value: false, label: "lastWins" },
        { value: true, label: "lastLoses" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [1, 5],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "streak", icon: "flame", metric: "bestStreak", tiers: [3, 5, 10] },
  ],
  // Every move is a pile and a count, and the piles come from the seed.
  scoreValidation: { kind: "replay" },
  tags: ["classic", "math", "quick"],
});
