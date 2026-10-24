// Client side of the registry: each game's code is its own chunk, loaded only
// when the player presses Play (SPEC §2: games are lazy-loaded).
import type { RaceEngine } from "@kefche/game-sdk";
import type { GameModule } from "@kefche/game-sdk/browser";

const modules = import.meta.glob<{ game: GameModule }>("../../../../../packages/games/*/index.ts");
// Race mode replays players' moves with the game's own engine (pure, no DOM).
const engines = import.meta.glob<{ engine: RaceEngine<unknown, unknown, unknown> }>(
  "../../../../../packages/games/*/engine/index.ts",
);

export async function loadGame(id: string): Promise<GameModule> {
  const load = modules[`../../../../../packages/games/${id}/index.ts`];
  if (!load) throw new Error(`Unknown game: ${id}`);
  return (await load()).game;
}

export async function loadRaceEngine(id: string): Promise<RaceEngine<unknown, unknown, unknown>> {
  const load = engines[`../../../../../packages/games/${id}/engine/index.ts`];
  if (!load) throw new Error(`Unknown game: ${id}`);
  return (await load()).engine;
}
