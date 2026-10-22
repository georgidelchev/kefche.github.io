// Client side of the registry: each game's code is its own chunk, loaded only
// when the player presses Play (SPEC §2: games are lazy-loaded).
import type { GameModule } from "@kefche/game-sdk/browser";

const modules = import.meta.glob<{ game: GameModule }>("../../../../../packages/games/*/index.ts");

export async function loadGame(id: string): Promise<GameModule> {
  const load = modules[`../../../../../packages/games/${id}/index.ts`];
  if (!load) throw new Error(`Unknown game: ${id}`);
  return (await load()).game;
}
