import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.6 #54: Trivia for 1 to 10 players, racing through ten questions
// from eight categories at three levels, with points for speed. The
// questions are written for kefche in each language (Phase 13 Q3), so the
// game is offered only where there's a bank (English and Bulgarian).
export const manifest = defineManifest({
  id: "trivia",
  version: 1,
  category: "party",
  kind: "race",
  players: { min: 1, max: 10, default: 4 },
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  timers: [{ kind: "countdown", seconds: 240 }],
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
      key: "topic",
      label: "topicOption",
      values: [
        { value: "mixed", label: "topicMixed" },
        { value: "geography", label: "topicGeography" },
        { value: "history", label: "topicHistory" },
        { value: "science", label: "topicScience" },
        { value: "nature", label: "topicNature" },
        { value: "sport", label: "topicSport" },
        { value: "arts", label: "topicArts" },
        { value: "music", label: "topicMusic" },
        { value: "food", label: "topicFood" },
      ],
    },
  ],
  contentPacks: ["en", "bg"],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard", "mouse"],
  renderer: "dom",
  estimatedMinutes: [2, 4],
  // Mixed games only, one board per language; the speed part is measured on
  // the player's device (Q6).
  leaderboards: [
    {
      id: "best-en",
      metric: "score",
      order: "desc",
      when: { pack: "en", topic: "mixed" },
      device: true,
    },
    {
      id: "best-bg",
      metric: "score",
      order: "desc",
      when: { pack: "bg", topic: "mixed" },
      device: true,
    },
  ],
  achievements: [
    { id: "played", icon: "repeat", metric: "played", tiers: [1, 25, 100] },
    { id: "brainbox", icon: "star", metric: "bestScore", tiers: [900, 1200, 1400] },
  ],
  // Every answer carries its time; the engine applies the limits.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 2 },
  tags: ["quiz", "knowledge", "brain", "multiplayer"],
});
