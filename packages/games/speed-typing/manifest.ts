import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.7 #64: type a passage as fast and as accurately as you can,
// alone or in a race of up to 8. The texts are public-domain classics and
// passages written for kefche in each language (Q4), so the game is offered
// only in English and Bulgarian until more languages have texts (Q1). Speed
// is measured on the player's device (Q6).
export const manifest = defineManifest({
  id: "speed-typing",
  version: 1,
  category: "word",
  kind: "race",
  players: { min: 1, max: 8, default: 1 },
  modes: ["solo", "race", "online-private", "online-public", "quick-match"],
  bots: { supported: false, difficulties: [], canFillSeats: false },
  timers: [{ kind: "countdown", seconds: 300 }],
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
      key: "length",
      label: "lengthOption",
      values: [
        { value: "short", label: "lengthShort" },
        { value: "long", label: "lengthLong" },
      ],
    },
  ],
  contentPacks: ["en", "bg"],
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["keyboard"],
  renderer: "dom",
  estimatedMinutes: [1, 3],
  leaderboards: [
    {
      id: "en-short",
      metric: "score",
      order: "desc",
      device: true,
      when: { pack: "en", length: "short" },
    },
    {
      id: "en-long",
      metric: "score",
      order: "desc",
      device: true,
      when: { pack: "en", length: "long" },
    },
    {
      id: "bg-short",
      metric: "score",
      order: "desc",
      device: true,
      when: { pack: "bg", length: "short" },
    },
    {
      id: "bg-long",
      metric: "score",
      order: "desc",
      device: true,
      when: { pack: "bg", length: "long" },
    },
  ],
  achievements: [
    { id: "played", icon: "repeat", metric: "played", tiers: [1, 25, 100] },
    { id: "swift", icon: "flame", metric: "bestScore", tiers: [40, 70, 100] },
  ],
  // The passage comes from the seed; every word and its time is checked in the replay.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 8 },
  tags: ["words", "speed", "single-player", "multiplayer"],
});
