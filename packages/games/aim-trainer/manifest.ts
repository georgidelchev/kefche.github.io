import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.8 #73: shrinking targets, accuracy stats. Twenty targets; a hit
// scores more the sooner it comes. Aiming needs a pointer.
export const manifest = defineManifest({
  id: "aim-trainer",
  version: 1,
  category: "speed",
  kind: "race",
  players: { min: 1, max: 10, default: 1 },
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  timers: [{ kind: "countdown", seconds: 120 }],
  options: [],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "mouse"],
  renderer: "dom",
  estimatedMinutes: [1, 2],
  leaderboards: [{ id: "best-score", metric: "score", order: "desc", device: true }],
  achievements: [
    { id: "played", icon: "repeat", metric: "played", tiers: [1, 25, 100] },
    { id: "sharpshooter", icon: "target", metric: "bestScore", tiers: [900, 1200, 1450] },
  ],
  // Every click carries where and when it landed; the engine judges it.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 15 },
  tags: ["speed", "reflex", "aim", "single-player"],
});
