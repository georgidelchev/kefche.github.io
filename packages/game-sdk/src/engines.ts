// Engine kinds (SPEC §9.4). Engines are pure and deterministic: no DOM, no
// clocks, no Math.random; time and randomness come in as inputs (RngState in
// the state, elapsed time in actions). The same engine then runs in the
// browser, in workers, in tests and in Deno (server-side validation).

import type { RngState } from "./prng";

/** Result of a finished game (solo or multiplayer). */
export interface GameResult {
  /** Final score, where the game has one. */
  score?: number;
  /** Play time in milliseconds, for timed games. */
  timeMs?: number;
  /** Per seat: 1 = win, 0.5 = draw, 0 = loss (multiplayer). */
  outcome?: number[];
  /** Whether the goal was reached (e.g. puzzle solved). */
  completed: boolean;
}

/**
 * Race / seeded puzzle (SPEC §9.4.4): one player's game from a shared seed.
 * Solo puzzles and arcade games use it; multiplayer race mode (Phase 5) runs
 * one engine per player on the same seed and compares progress.
 */
export interface RaceEngine<State, Action, Config = undefined> {
  initialState(config: Config, seed: string): State;
  /** Applies a player action. Illegal actions return the same state object. */
  apply(state: State, action: Action): State;
  /** 0–1, shown to opponents in race mode. */
  progress(state: State): number;
  /** Null while the game is running. */
  result(state: State): GameResult | null;
  /** The score so far, for games that have one (a race can end before the game does). */
  score?(state: State): number;
  /** Race mode: false for actions a race doesn't allow, such as hints (they also mark a game as assisted). */
  allowedInRace?(action: Action): boolean;
  /**
   * The least real time an action takes, for games that run their own clock
   * (Snake's ticks): the server checks a result's time against the sum
   * (SPEC §12.5). Actions without one take none.
   */
  actionMs?(state: State, action: Action): number;
}

/**
 * Turn-based games (SPEC §9.4.1). Extra turns, passes and skipped seats are
 * the game's rules: `currentSeats` always says who moves next.
 */
export interface TurnEngine<State, Action, Config = undefined> {
  initialState(config: Config, seats: number, seed: string): State;
  /** Empty when `seat` can't act now. */
  legalActions(state: State, seat: number): Action[];
  /**
   * For moves that can't all be listed (a typed word in Associations):
   * whether `action`, as it arrived, is a legal move for `seat` now. Then
   * `legalActions` lists only what a clock running out or a stand-in may
   * choose, and the table, rooms and the server's replay also take any
   * move this accepts. It must be as strict as `applyAction`.
   */
  accepts?(state: State, seat: number, action: unknown): action is Action;
  /** Applies a seat's action. Illegal actions return the same state object. */
  applyAction(state: State, seat: number, action: Action): State;
  /** Seats that may act now (more than one for simultaneous turns); empty once finished. */
  currentSeats(state: State): number[];
  result(state: State): GameResult | null;
  /**
   * Online: the turn of `seat`, whose player is away, passes (SPEC §10.5).
   * Returns the same state when it can't be skipped.
   */
  skipTurn?(state: State, seat: number): State;
  /**
   * Actions `seat` may take at any moment without taking its turn, such as
   * resigning or offering a draw. They leave the clocks alone, and bots and
   * random moves never choose them. They go through `applyAction` like moves.
   */
  sideActions?(state: State, seat: number): Action[];
  /** What running out of time means for `seat`; by default it loses and everyone else wins. */
  timeoutResult?(state: State, seat: number): GameResult;
  /**
   * Games with hidden information (manifest `hiddenInformation`): the state
   * as `seat` may see it, or as everyone may (null: spectators, and the
   * screen between two players on one device). Other seats' secrets and the
   * randomness still to come (the Rng, the undealt cards) are blanked out,
   * in the same shape. Renderers and bots only ever get views, so a view
   * must answer `legalActions` for its own seat exactly as the state does,
   * and `currentSeats` and `result` for everyone.
   */
  view?(state: State, seat: number | null): State;
  /**
   * How `viewer` may see an action `seat` took (the table tells everyone
   * the last move): the action itself by default, a blanked copy for a
   * secret one (the cards passed in Hearts, a fleet placed), or null to
   * show only that `seat` moved.
   */
  viewAction?(action: Action, seat: number, viewer: number | null): Action | null;
}

/** The state `seat` may see: the engine's view, or the whole state for a game with no secrets. */
export function viewFor<State, Action, Config>(
  engine: TurnEngine<State, Action, Config>,
  state: State,
  seat: number | null,
): State {
  return engine.view ? engine.view(state, seat) : state;
}

/**
 * JSON with object keys sorted, so the same value always gives the same text
 * (a relay through the database reorders keys).
 */
export function canonicalJson(value: unknown): string {
  const sorted = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sorted)
      : v !== null && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => (a < b ? -1 : 1))
              .map(([k, x]) => [k, sorted(x)]),
          )
        : v;
  // null for undefined, which JSON.stringify would turn into no text at all.
  return JSON.stringify(sorted(value) ?? null);
}

/** Whether two actions are the same, compared as data (key order doesn't matter). */
export const sameAction = (a: unknown, b: unknown): boolean =>
  canonicalJson(a) === canonicalJson(b);

/**
 * The move `seat` may make now equal to `action` (as data): one of its legal
 * actions, or, for an engine with `accepts`, the action itself. Undefined
 * when it isn't legal. Side actions are checked apart (`isSideAction`).
 */
export function legalMove<State, Action, Config>(
  engine: TurnEngine<State, Action, Config>,
  state: State,
  seat: number,
  action: unknown,
): Action | undefined {
  const listed = engine.legalActions(state, seat).find((a) => sameAction(a, action));
  if (listed !== undefined) return listed;
  if (engine.accepts?.(state, seat, action)) return action;
  return undefined;
}

/** True when `action` is one of `seat`'s side actions now (compared as data). */
export function isSideAction<State, Action, Config>(
  engine: TurnEngine<State, Action, Config>,
  state: State,
  seat: number,
  action: unknown,
): boolean {
  return (engine.sideActions?.(state, seat) ?? []).some((a) => sameAction(a, action));
}

/** One move in a turn-based match, as stored for replays. */
export interface TurnMove<Action> {
  seat: number;
  action: Action;
}

// Real-time arenas (SPEC §9.4.2) have their own contract: realtime.ts.

// Simultaneous-choice rounds (SPEC §9.4.3) are turn engines whose
// `currentSeats` lists everyone still to choose: `view` keeps each choice
// hidden until the engine reveals the round, and the turn runtime runs the
// bots, clocks and the device handoff for several seats at once (Phase 12).

/** Common shape for states that carry their own randomness. */
export interface SeededState {
  rng: RngState;
}

/** Applies actions in order: replays, tests and server-side validation. */
export function replay<State, Action, Config>(
  engine: RaceEngine<State, Action, Config>,
  config: Config,
  seed: string,
  actions: Iterable<Action>,
): State {
  let state = engine.initialState(config, seed);
  for (const action of actions) state = engine.apply(state, action);
  return state;
}

/** The turn-based `replay()`: applies seated moves in order. */
export function replayTurns<State, Action, Config>(
  engine: TurnEngine<State, Action, Config>,
  config: Config,
  seats: number,
  seed: string,
  moves: Iterable<TurnMove<Action>>,
): State {
  let state = engine.initialState(config, seats, seed);
  for (const { seat, action } of moves) state = engine.applyAction(state, seat, action);
  return state;
}
