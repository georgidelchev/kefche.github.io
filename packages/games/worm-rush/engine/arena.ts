// How Worm Rush's arenas are filled, the same on the arena server and in the
// solo arena: bots to 10, at most 15 people, bots in a mix of difficulties
// with short names that read in every language, back 3 s after a knockout.
import type { ArenaHostOptions, BotDifficulty } from "@kefche/game-sdk";

import { TICKS_PER_SECOND } from "./world";

/** Looks a player may pick (0 to LOOKS − 1): the skins. */
export const LOOKS = 12;

const BOT_NAMES = [
  "Mila",
  "Teo",
  "Ana",
  "Kai",
  "Lena",
  "Omar",
  "Yuki",
  "Nia",
  "Ivo",
  "Sara",
  "Leo",
  "Ema",
  "Rafa",
  "Zoe",
  "Niko",
  "Aya",
  "Dani",
  "Iris",
  "Mateo",
  "Lia",
];

export const arenaHost: Omit<ArenaHostOptions<undefined>, "seed" | "config"> = {
  minimumPopulation: 10,
  maxPeople: 15,
  botDifficulties: ["easy", "medium", "easy", "hard", "medium"],
  botJoiner: (n: number, difficulty: BotDifficulty) => ({
    name: BOT_NAMES[n % BOT_NAMES.length] ?? "Bot",
    // Bots wear the free looks; which one follows from their number.
    look: (n * 5 + difficulty.length) % 4,
  }),
  botRespawnTicks: 3 * TICKS_PER_SECOND,
};
