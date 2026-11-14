import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.7 #70: decode and encode Morse with audio. A minute of letters:
// read a code (seen and heard) and answer with its letter, or send a
// letter's code in dots and dashes. International Morse in English and the
// Cyrillic table in Bulgarian, so the game is offered only in those
// languages until others have their tables (Q1). Speed is measured on the
// player's device (Q6).
export const manifest = defineManifest({
  id: "morse-master",
  version: 1,
  category: "word",
  kind: "race",
  players: { min: 1, max: 8, default: 1 },
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  timers: [{ kind: "countdown", seconds: 120 }],
  options: [
    {
      key: "pack",
      label: "packOption",
      values: [
        { value: "en", label: "packEn", defaultIn: ["en"] },
        { value: "bg", label: "packBg", defaultIn: ["bg"] },
      ],
    },
    {
      key: "task",
      label: "taskOption",
      values: [
        { value: "read", label: "taskRead" },
        { value: "send", label: "taskSend" },
      ],
    },
  ],
  contentPacks: ["en", "bg"],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard", "mouse"],
  renderer: "dom",
  estimatedMinutes: [1, 2],
  leaderboards: [
    {
      id: "en-read",
      metric: "score",
      order: "desc",
      device: true,
      when: { pack: "en", task: "read" },
    },
    {
      id: "en-send",
      metric: "score",
      order: "desc",
      device: true,
      when: { pack: "en", task: "send" },
    },
    {
      id: "bg-read",
      metric: "score",
      order: "desc",
      device: true,
      when: { pack: "bg", task: "read" },
    },
    {
      id: "bg-send",
      metric: "score",
      order: "desc",
      device: true,
      when: { pack: "bg", task: "send" },
    },
  ],
  achievements: [
    { id: "played", icon: "repeat", metric: "played", tiers: [1, 25, 100] },
    { id: "operator", icon: "star", metric: "bestScore", tiers: [15, 30, 50] },
  ],
  // The letters come from the seed; every answer and its time is checked in the replay.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 10 },
  tags: ["words", "speed", "single-player", "multiplayer"],
});
