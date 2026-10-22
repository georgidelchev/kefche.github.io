// Puzzle creation and the saved game, around the pure engine.
import { runInWorker, type GameStorage } from "@kefche/game-sdk/browser";

import { fromPuzzle, generate, restore, toSaved, type Difficulty, type State } from "../engine";

const SAVE_KEY = "current";

/**
 * A new game in a worker. Generation takes milliseconds, so if workers are
 * unavailable or fail, it runs here instead.
 */
export async function newGame(seed: string, difficulty: Difficulty): Promise<State> {
  try {
    const reply = await runInWorker(
      () => new Worker(new URL("./generate.worker.ts", import.meta.url), { type: "module" }),
      { seed, difficulty },
      { budgetMs: 8000 },
    );
    const state = restore(reply);
    if (state) return state;
  } catch {
    // Falls through to the main thread.
  }
  return fromPuzzle(generate(seed, difficulty));
}

export interface SavedGame {
  state: State;
  elapsedMs: number;
}

export function loadSaved(storage: GameStorage): SavedGame | null {
  try {
    const data: unknown = JSON.parse(storage.get(SAVE_KEY) ?? "null");
    if (typeof data !== "object" || data === null) return null;
    const { state, elapsedMs } = data as Record<string, unknown>;
    const restored = restore(state);
    return restored && typeof elapsedMs === "number" && elapsedMs >= 0
      ? { state: restored, elapsedMs }
      : null;
  } catch {
    return null;
  }
}

export function save(storage: GameStorage, game: SavedGame | null): void {
  storage.set(
    SAVE_KEY,
    game ? JSON.stringify({ state: toSaved(game.state), elapsedMs: game.elapsedMs }) : null,
  );
}

const bestKey = (difficulty: Difficulty) => `best:${difficulty}`;

/** Fastest solve per difficulty, in milliseconds. */
export function bestTime(storage: GameStorage, difficulty: Difficulty): number | null {
  const ms = Number(storage.get(bestKey(difficulty)));
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/** Records a solve; true when it beat the previous best. */
export function recordTime(storage: GameStorage, difficulty: Difficulty, ms: number): boolean {
  const best = bestTime(storage, difficulty);
  if (best !== null && best <= ms) return false;
  storage.set(bestKey(difficulty), String(Math.round(ms)));
  return true;
}
