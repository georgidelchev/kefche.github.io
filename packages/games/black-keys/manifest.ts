import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.8 #74: tap only the black tiles while they scroll (an original
// name and look). Endless, faster and faster; the score is the tiles.
export const manifest = defineManifest({
  id: "black-keys",
  version: 1,
  category: "speed",
  kind: "race",
  players: { min: 1, max: 10, default: 1 },
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  timers: [{ kind: "countdown", seconds: 300 }],
  options: [],
  rated: false,
  hiddenInformation: false,
  orientation: "portrait",
  controls: ["tap", "keyboard", "mouse"],
  renderer: "dom",
  estimatedMinutes: [1, 3],
  leaderboards: [{ id: "most-tiles", metric: "score", order: "desc", device: true }],
  achievements: [
    { id: "played", icon: "repeat", metric: "played", tiers: [1, 25, 100] },
    { id: "pianist", icon: "flame", metric: "bestScore", tiers: [50, 120, 220] },
  ],
  // Every tap carries its tile and time; the engine knows the scroll.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 20 },
  tags: ["speed", "reflex", "rhythm", "single-player"],
});
