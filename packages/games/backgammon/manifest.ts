import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.1 #3: Backgammon, a single game or a match to 3 or 5, with the
// doubling cube as an option (points only, no stakes). The dice must not
// be known in advance, so online matches play on a table on the arena
// server, which rolls them (hiddenInformation, ADR-0047).
export const manifest = defineManifest({
  id: "backgammon",
  version: 1,
  category: "board",
  kind: "turn",
  players: { min: 2, max: 2, default: 2 },
  modes: ["solo-bots", "hotseat", "online-private", "online-public", "quick-match"],
  bots: { supported: true, difficulties: ["easy", "medium", "hard"], canFillSeats: true },
  timers: [
    { kind: "none" },
    { kind: "per-move", seconds: 30, onExpiry: "random-move" },
    { kind: "per-move", seconds: 60, onExpiry: "random-move" },
  ],
  options: [
    {
      key: "match",
      label: "matchOption",
      values: [
        { value: 1, label: "match1" },
        { value: 3, label: "match3" },
        { value: 5, label: "match5" },
      ],
    },
    {
      key: "cube",
      label: "cubeOption",
      values: [
        { value: false, label: "cubeOff" },
        { value: true, label: "cubeOn" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: true,
  orientation: "any",
  controls: ["tap", "keyboard"],
  renderer: "dom",
  estimatedMinutes: [5, 30],
  leaderboards: [],
  achievements: [
    { id: "winner", icon: "crown", metric: "wins", tiers: [1, 25, 100] },
    { id: "streak", icon: "flame", metric: "bestStreak", tiers: [3, 5, 10] },
  ],
  // Every roll comes from the seed and every checker move is logged.
  scoreValidation: { kind: "replay" },
  tags: ["dice", "classic", "two-player", "strategy"],
});
