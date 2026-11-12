import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.8 #77: repeat growing colour and sound sequences. Four pads,
// each with its own colour, sound and shape; the score is the longest.
export const manifest = defineManifest({
  id: "sequence-memory",
  version: 1,
  category: "speed",
  kind: "race",
  players: { min: 1, max: 10, default: 1 },
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  timers: [{ kind: "countdown", seconds: 600 }],
  options: [],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard", "mouse"],
  renderer: "dom",
  estimatedMinutes: [1, 5],
  leaderboards: [{ id: "longest", metric: "score", order: "desc" }],
  achievements: [
    { id: "played", icon: "repeat", metric: "played", tiers: [1, 25, 100] },
    { id: "memory", icon: "star", metric: "bestScore", tiers: [8, 14, 20] },
  ],
  // The sequence comes from the seed; each round's showing takes its time.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 10 },
  tags: ["speed", "memory", "sound", "single-player"],
});
