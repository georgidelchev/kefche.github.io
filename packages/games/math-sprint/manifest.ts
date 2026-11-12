import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.8 #80: mental arithmetic with difficulty levels. Sixty seconds
// of problems at easy, medium or hard; the score is the right answers.
export const manifest = defineManifest({
  id: "math-sprint",
  version: 1,
  category: "speed",
  kind: "race",
  players: { min: 1, max: 10, default: 2 },
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  timers: [{ kind: "countdown", seconds: 120 }],
  options: [
    {
      key: "level",
      label: "level",
      values: [
        { value: "easy", label: "levelEasy" },
        { value: "medium", label: "levelMedium" },
        { value: "hard", label: "levelHard" },
      ],
    },
  ],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard", "mouse"],
  renderer: "dom",
  estimatedMinutes: [1, 2],
  leaderboards: [
    { id: "best-easy", metric: "score", order: "desc", when: { level: "easy" }, device: true },
    { id: "best-medium", metric: "score", order: "desc", when: { level: "medium" }, device: true },
    { id: "best-hard", metric: "score", order: "desc", when: { level: "hard" }, device: true },
  ],
  achievements: [
    { id: "played", icon: "repeat", metric: "played", tiers: [1, 25, 100] },
    { id: "quick-maths", icon: "star", metric: "bestScore", tiers: [20, 32, 45] },
  ],
  // Every answer carries its time; the engine applies the limits.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 6 },
  tags: ["speed", "numbers", "brain", "single-player"],
});
