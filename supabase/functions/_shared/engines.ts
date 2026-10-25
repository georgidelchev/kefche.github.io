// The games' engines and manifests on the server (Phase 7), bundled from
// packages/games by `pnpm functions:engines` into engines.gen.js, so a result
// is replayed with the code the browser ran. The types mirror
// @kefche/game-sdk's, which Deno can't import (its sources import without file
// extensions).
import { canonicalJson, GAMES as BUNDLED, RACE_LOG_LIMITS, unpackActions } from "./engines.gen.js";

export { canonicalJson, RACE_LOG_LIMITS, unpackActions };

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
  /** False for actions a race doesn't allow (hints): they mark a game as assisted. */
  allowedInRace?(action: unknown): boolean;
  /** The least real time an action takes (Snake's ticks). */
  actionMs?(state: unknown, action: unknown): number;
}

/** Turn-based games (the SDK's TurnEngine). */
export interface TurnEngine {
  initialState(config: unknown, seats: number, seed: string): unknown;
  legalActions(state: unknown, seat: number): unknown[];
  applyAction(state: unknown, seat: number, action: unknown): unknown;
  currentSeats(state: unknown): number[];
  result(state: unknown): GameResult | null;
  sideActions?(state: unknown, seat: number): unknown[];
  /** The result when `seat` runs out of time (chess: a draw if nobody can mate). */
  timeoutResult?(state: unknown, seat: number): GameResult;
}

/** A setting a single-player game is played with (the manifest's raceOptions). */
export interface GameOption {
  key: string;
  values: { value: string | number | boolean }[];
}

/** A timer preset (the manifest's TimerPreset). Values in seconds. */
export type TimerPreset =
  | { kind: "none" }
  | { kind: "per-move"; seconds: number; onExpiry: "pass" | "random-move" | "loss" }
  | { kind: "clock"; base: number; increment: number }
  | { kind: "countdown"; seconds: number };

/** What the server checks a game's results with, from its manifest. */
interface Rules {
  version: number;
  modes: readonly string[];
  players: { min: number; max: number };
  timers: readonly TimerPreset[];
  /** Online, an away player's clock runs on ("clock"), so rooms use only clocks. */
  awayPlayers: "skip" | "clock";
  /** The timer a new room starts with (an index into `timers`). */
  onlineTimer: number | null;
  options: readonly GameOption[];
  /** The most actions a person makes in a second, when the manifest says. */
  maxActionsPerSecond: number | null;
}

export type ServerGame =
  (Rules & { kind: "race"; engine: RaceEngine }) | (Rules & { kind: "turn"; engine: TurnEngine });

interface BundledManifest {
  kind: "race" | "turn";
  version: number;
  modes: string[];
  players: { min: number; max: number };
  timers: TimerPreset[];
  awayPlayers?: "skip" | "clock";
  onlineTimer?: number;
  raceOptions?: GameOption[];
  scoreValidation: { kind: string; maxActionsPerSecond?: number };
}

/** Every game by id. */
export const GAMES: ReadonlyMap<string, ServerGame> = new Map(
  Object.entries(BUNDLED).map(([id, { manifest, engine }]) => {
    const m = manifest as BundledManifest;
    const rules: Rules = {
      version: m.version,
      modes: m.modes,
      players: { min: m.players.min, max: m.players.max },
      timers: m.timers,
      awayPlayers: m.awayPlayers ?? "skip",
      onlineTimer: m.onlineTimer ?? null,
      options: m.raceOptions ?? [],
      maxActionsPerSecond: m.scoreValidation.maxActionsPerSecond ?? null,
    };
    const game: ServerGame =
      m.kind === "race"
        ? { ...rules, kind: "race", engine: engine as RaceEngine }
        : { ...rules, kind: "turn", engine: engine as TurnEngine };
    return [id, game];
  }),
);

export interface RaceReplay {
  state: unknown;
  result: GameResult | null;
  score: number | null;
  progress: number;
  /** The least real time the actions took (the sum of `actionMs`). */
  minMs: number;
  /** Actions the player chose (the game's own timed ones, like Snake's ticks, left out). */
  choices: number;
  /** Some action wasn't allowed in a race (a hint). */
  assisted: boolean;
}

/** A single-player game replayed from its seed, every action in order. */
export function replayRace(
  engine: RaceEngine,
  config: unknown,
  seed: string,
  actions: readonly unknown[],
): RaceReplay {
  let state = engine.initialState(config, seed);
  let minMs = 0;
  let choices = 0;
  let assisted = false;
  for (const action of actions) {
    const ms = engine.actionMs?.(state, action) ?? 0;
    minMs += ms;
    if (ms === 0) choices++;
    if (engine.allowedInRace?.(action) === false) assisted = true;
    state = engine.apply(state, action);
  }
  return {
    state,
    result: engine.result(state),
    score: engine.score?.(state) ?? null,
    progress: engine.progress(state),
    minMs,
    choices,
    assisted,
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
