import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.1 #6: 9 × 9 (the default), with 13 × 13 as an option; Japanese
// scoring with komi; the ko rule. A per-move timer running out passes (the
// renderer's passAction). 9 × 9 is rated (Phase 11 Q2).
export const manifest = defineManifest({
  id: "go",
  version: 1,
  category: "board",
  kind: "turn",
  players: { min: 2, max: 2, default: 2 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 30, onExpiry: "pass" },
    { kind: "per-move", seconds: 60, onExpiry: "pass" },
    { kind: "clock", base: 300, increment: 3 },
    { kind: "clock", base: 600, increment: 5 },
    { kind: "clock", base: 1200, increment: 10 },
  ],
  options: [
    {
      key: "size",
      label: "size",
      values: [
        { value: 9, label: "size9" },
        { value: 13, label: "size13" },
      ],
    },
  ],
  // One pool, 9 × 9, on the three clocks (private.rated_clocks, migration
  // 20261110100100).
  rated: {
    system: "glicko2",
    pools: [{ id: "board9", timers: [3, 4, 5], config: { size: 9 } }],
  },
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [10, 40],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "streak", icon: "flame", metric: "bestStreak", tiers: [3, 5, 10] },
    { id: "rated", icon: "medal", metric: "rating", tiers: [1600, 1800, 2000] },
  ],
  // Every move, pass and count is an action, so a match replays exactly (Phase 7 validation).
  scoreValidation: { kind: "replay" },
  tags: ["classic", "two-player", "strategy"],
});
