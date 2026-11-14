import { defineManifest } from "@kefche/game-sdk";

// SPEC §20.7 #62: guess a five-letter word in six tries, with an original
// name and look. The day's word is the same for everyone in a language,
// from the server (words_of_the_day, with an admin override); practice and
// races take one from the seed. Guesses are checked against the language's
// dictionary (lexicons, ADR-0050), so the game is offered only in English
// and Bulgarian (Q1). The answer reaches the browser at the start, so there
// are no leaderboards: the daily "race" is the streak (Q5).
export const manifest = defineManifest({
  id: "word-of-the-day",
  version: 1,
  category: "word",
  kind: "race",
  players: { min: 1, max: 8, default: 1 },
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
  ],
  contentPacks: ["en", "bg"],
  lexicons: ["all"],
  // Today's game carries the day's word; submit-match checks it.
  dailyPuzzle: "word",
  rated: false,
  hiddenInformation: false,
  orientation: "any",
  controls: ["tap", "keyboard", "mouse"],
  renderer: "dom",
  estimatedMinutes: [2, 5],
  leaderboards: [],
  achievements: [
    { id: "played", icon: "repeat", metric: "played", tiers: [1, 30, 100] },
    { id: "sharp", icon: "target", metric: "bestScore", tiers: [3, 4, 5] },
  ],
  // The word comes from the seed or the config; every guess is checked in the replay.
  scoreValidation: { kind: "replay", maxActionsPerSecond: 3 },
  tags: ["words", "puzzle", "single-player", "daily"],
});
