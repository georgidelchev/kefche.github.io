import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.4 #32: classic grid snake, 1–8 players (race).
export const manifest = defineManifest({
  id: "snake",
  version: 1,
  category: "arcade",
  kind: "race",
  players: { min: 1, max: 8, default: 1 },
  // Race mode (same seed for everyone) arrives with multiplayer in Phase 5.
  modes: ["solo"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  timers: [{ kind: "none" }],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["swipe", "keyboard", "tap"],
  renderer: "canvas",
  offline: true,
  estimatedMinutes: [1, 10],
  leaderboards: [{ id: "best-score", metric: "score", order: "desc" }],
  achievements: [],
  // Food comes from the seed and time is a stream of ticks, so a game replays
  // exactly from its inputs (Phase 7 validates submissions).
  scoreValidation: { kind: "replay" },
  tags: ["classic", "reflexes", "single-player"],
});
