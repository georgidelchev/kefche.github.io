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
}

/**
 * Turn-based games (SPEC §9.4.1). Extra turns, passes and skipped seats are
 * the game's rules: `currentSeats` always says who moves next.
 */
export interface TurnEngine<State, Action, Config = undefined> {
  initialState(config: Config, seats: number, seed: string): State;
  /** Empty when `seat` can't act now. */
  legalActions(state: State, seat: number): Action[];
  /** Applies a seat's action. Illegal actions return the same state object. */
  applyAction(state: State, seat: number, action: Action): State;
  /** Seats that may act now (more than one for simultaneous turns); empty once finished. */
  currentSeats(state: State): number[];
  result(state: State): GameResult | null;
}

/** One move in a turn-based match, as stored for replays. */
export interface TurnMove<Action> {
  seat: number;
  action: Action;
}

/** Real-time games (SPEC §9.4.2). Fixed timestep; implemented in Phase 9. */
export interface RealtimeEngine<State, Input, Config = undefined> {
  readonly ticksPerSecond: number;
  initialState(config: Config, seats: number, seed: string): State;
  step(state: State, inputs: ReadonlyMap<number, Input>): State;
  result(state: State): GameResult | null;
}

/** Simultaneous-choice rounds (SPEC §9.4.3). Implemented with party games. */
export interface RoundEngine<State, Choice, Config = undefined> {
  initialState(config: Config, seats: number, seed: string): State;
  submit(state: State, seat: number, choice: Choice): State;
  /** True when every active seat has chosen (or the round timer expired). */
  readyToReveal(state: State): boolean;
  reveal(state: State): State;
  result(state: State): GameResult | null;
}

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
