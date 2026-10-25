// The games' engines and manifests on the server (Phase 7), bundled from
// packages/games by `pnpm functions:engines` into engines.gen.js, so a result
// is replayed with the code the browser ran. The types mirror
// @kefche/game-sdk's, which Deno can't import (its sources import without file
// extensions).
import { canonicalJson, GAMES as BUNDLED } from "./engines.gen.js";

export { canonicalJson };

/** How a game ended (the SDK's GameResult). */
export interface GameResult {
  score?: number;
  timeMs?: number;
  /** Per seat: 1 win, 0.5 draw, 0 loss. */
  outcome?: number[];
  completed: boolean;
}

/** Single-player games, raced or solo, on a seed (the SDK's RaceEngine). */
export interface RaceEngine {
  initialState(config: unknown, seed: string): unknown;
  apply(state: unknown, action: unknown): unknown;
  progress(state: unknown): number;
  result(state: unknown): GameResult | null;
  score?(state: unknown): number;
}

/** Turn-based games (the SDK's TurnEngine). */
export interface TurnEngine {
  initialState(config: unknown, seats: number, seed: string): unknown;
  legalActions(state: unknown, seat: number): unknown[];
  applyAction(state: unknown, seat: number, action: unknown): unknown;
  currentSeats(state: unknown): number[];
  result(state: unknown): GameResult | null;
  sideActions?(state: unknown, seat: number): unknown[];
}

export type ServerGame =
  | { kind: "race"; version: number; engine: RaceEngine }
  | { kind: "turn"; version: number; engine: TurnEngine };

/** Every game by id. */
export const GAMES: ReadonlyMap<string, ServerGame> = new Map(
  Object.entries(BUNDLED).map(([id, { manifest, engine }]) => {
    const { kind, version } = manifest as { kind: "race" | "turn"; version: number };
    const game =
      kind === "race"
        ? { kind, version, engine: engine as RaceEngine }
        : { kind, version, engine: engine as TurnEngine };
    return [id, game];
  }),
);

export interface RaceReplay {
  state: unknown;
  result: GameResult | null;
  score: number | null;
  progress: number;
}

/** A single-player game replayed from its seed, every action in order. */
export function replayRace(
  engine: RaceEngine,
  config: unknown,
  seed: string,
  actions: readonly unknown[],
): RaceReplay {
  let state = engine.initialState(config, seed);
  for (const action of actions) state = engine.apply(state, action);
  return {
    state,
    result: engine.result(state),
    score: engine.score?.(state) ?? null,
    progress: engine.progress(state),
  };
}

export interface SeatedAction {
  seat: number;
  action: unknown;
}

export interface TurnReplay {
  state: unknown;
  result: GameResult | null;
  /** Actions that weren't the seat's to take when they came, or came after the end. */
  refused: number;
}

/**
 * A turn game replayed from its start. Each action must be one the engine
 * offers that seat then: a move on its turn, or a side action (resign, a draw
 * offer) at any time. Anything else is refused and skipped.
 */
export function replayTurn(
  engine: TurnEngine,
  config: unknown,
  seats: number,
  seed: string,
  moves: readonly SeatedAction[],
): TurnReplay {
  let state = engine.initialState(config, seats, seed);
  let refused = 0;
  for (const { seat, action } of moves) {
    const offered =
      engine.result(state) === null
        ? [
            ...(engine.currentSeats(state).includes(seat) ? engine.legalActions(state, seat) : []),
            ...(engine.sideActions?.(state, seat) ?? []),
          ]
        : [];
    const wanted = canonicalJson(action);
    const legal = offered.find((a) => canonicalJson(a) === wanted);
    if (legal === undefined) refused++;
    else state = engine.applyAction(state, seat, legal);
  }
  return { state, result: engine.result(state), refused };
}
