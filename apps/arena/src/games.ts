// The games the arena server runs, by id (their manifests' ids). Each is the
// game's own engine and bots, with how its arenas are filled.
import type { ArenaBots, ArenaHostOptions, BotDifficulty, RealtimeEngine } from "@kefche/game-sdk";
import { bots as wormBots, engine as wormEngine } from "@kefche/game-worm-rush/engine";

export interface ArenaGame {
  engine: RealtimeEngine<unknown, unknown, unknown, unknown>;
  bots: ArenaBots<unknown, unknown>;
  host: Omit<ArenaHostOptions<undefined>, "seed" | "config">;
  /** Looks a player may pick (0 to looks − 1). */
  looks: number;
}

/** Bots' names: short, and readable in every language's page. */
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

const botJoiner = (n: number, difficulty: BotDifficulty) => ({
  name: BOT_NAMES[n % BOT_NAMES.length] ?? "Bot",
  // Bots wear the free looks; which one follows from their number.
  look: (n * 5 + difficulty.length) % 4,
});

// The engine's types are its own; the server only moves bytes between it and the sockets.
const erase = <World, Input, Snapshot, Event>(
  engine: RealtimeEngine<World, Input, Snapshot, Event>,
  bots: ArenaBots<World, Input>,
) => ({
  engine: engine as unknown as RealtimeEngine<unknown, unknown, unknown, unknown>,
  bots: bots as unknown as ArenaBots<unknown, unknown>,
});

export const GAMES: Readonly<Record<string, ArenaGame>> = {
  "worm-rush": {
    ...erase(wormEngine, wormBots),
    host: {
      minimumPopulation: 10,
      maxPeople: 15,
      botDifficulties: ["easy", "medium", "easy", "hard", "medium"],
      botJoiner,
      botRespawnTicks: 3 * 30,
    },
    looks: 12,
  },
};
