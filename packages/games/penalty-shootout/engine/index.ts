// Penalty Shootout (SPEC §20.6 #93): two players take turns to shoot and
// to keep goal, five kicks each, then sudden death.
// - The shooter picks one of six spots (left, centre or right, low or
//   high) and the keeper a dive (left, centre or right), at once and in
//   secret. Left and right are as the shooter sees the goal.
// - A shot into the keeper's column is saved, except a high corner, which
//   is out of reach. Aiming high has a cost: a high corner goes over the
//   bar one time in three, a high centre one time in six.
// - The shootout ends as soon as one side can't catch up. After five kicks
//   each, kicks go in pairs until one scores and the other doesn't; after
//   30 kicks each it's a draw.
// The misses come from the state's Rng, and choices wait hidden until both
// are in, so online the table holds both (ADR-0047).
import { Rng, sameAction, type GameResult, type RngState, type TurnEngine } from "@kefche/game-sdk";

export const SPOTS = 6;
export const DIVES = 3;
export const KICKS = 5;
const MAX_KICKS = 30;
/** A choice made but not shown yet (in a view). */
export const SECRET = -1;

export const columnOf = (spot: number) => spot % 3;
export const isHigh = (spot: number) => spot >= 3;
/** The chance a shot at `spot` goes over the bar. */
export const overChance = (spot: number) =>
  !isHigh(spot) ? 0 : columnOf(spot) === 1 ? 1 / 6 : 1 / 3;

export type Result = "goal" | "saved" | "over";

export interface Kick {
  shooter: number;
  spot: number;
  dive: number;
  result: Result;
}

export interface State {
  /** This kick's choices: null not yet, SECRET hidden in a view. */
  shot: number | null;
  dive: number | null;
  /** Kicks taken so far, in order. Seat 0 shoots first. */
  kicks: Kick[];
  winner: number | null;
  draw: boolean;
  moves: number;
  rng: RngState;
}

export type Action = { shoot: number } | { dive: number };

/** Who shoots next: seats alternate, 0 first. */
export const shooterOf = (s: State) => s.kicks.length % 2;
export const keeperOf = (s: State) => 1 - shooterOf(s);

export function goals(s: State, seat: number): number {
  return s.kicks.filter((k) => k.shooter === seat && k.result === "goal").length;
}

const kicksBy = (s: State, seat: number) => s.kicks.filter((k) => k.shooter === seat).length;

function initialState(_config: unknown, _seats: number, seed: string): State {
  return {
    shot: null,
    dive: null,
    kicks: [],
    winner: null,
    draw: false,
    moves: 0,
    rng: Rng.fromSeed(seed).state,
  };
}

const over = (s: State) => s.winner !== null || s.draw;

function legalActions(s: State, seat: number): Action[] {
  if (over(s)) return [];
  if (seat === shooterOf(s) && s.shot === null)
    return Array.from({ length: SPOTS }, (_, spot) => ({ shoot: spot }));
  if (seat === keeperOf(s) && s.dive === null)
    return Array.from({ length: DIVES }, (_, dive) => ({ dive }));
  return [];
}

/** Has the shootout been decided? */
function decide(s: State): State {
  const [a, b] = [goals(s, 0), goals(s, 1)];
  const [ka, kb] = [kicksBy(s, 0), kicksBy(s, 1)];
  if (ka <= KICKS && kb <= KICKS) {
    // In the first five: stop when one side can't catch up.
    if (a > b + (KICKS - kb)) return { ...s, winner: 0 };
    if (b > a + (KICKS - ka)) return { ...s, winner: 1 };
    return s;
  }
  // Sudden death: after each pair of kicks.
  if (ka === kb && a !== b) return { ...s, winner: a > b ? 0 : 1 };
  if (ka >= MAX_KICKS && kb >= MAX_KICKS) return { ...s, draw: true };
  return s;
}

function applyAction(s: State, seat: number, action: Action): State {
  if (!legalActions(s, seat).some((a) => sameAction(a, action))) return s;
  const next: State = {
    ...s,
    shot: "shoot" in action ? action.shoot : s.shot,
    dive: "dive" in action ? action.dive : s.dive,
    moves: s.moves + 1,
  };
  if (next.shot === null || next.dive === null) return next;
  const rng = new Rng(s.rng);
  const spot = next.shot;
  const dive = next.dive;
  const reach = columnOf(spot) === dive && !(isHigh(spot) && columnOf(spot) !== 1);
  const result: Result = rng.next() < overChance(spot) ? "over" : reach ? "saved" : "goal";
  const kick: Kick = { shooter: shooterOf(s), spot, dive, result };
  return decide({ ...next, shot: null, dive: null, kicks: [...s.kicks, kick], rng: rng.state });
}

function currentSeats(s: State): number[] {
  if (over(s)) return [];
  return [shooterOf(s), keeperOf(s)]
    .filter((seat) => (seat === shooterOf(s) ? s.shot === null : s.dive === null))
    .sort((x, y) => x - y);
}

function result(s: State): GameResult | null {
  if (s.draw) return { completed: true, outcome: [0.5, 0.5] };
  if (s.winner === null) return null;
  return { completed: true, outcome: [0, 1].map((seat) => (seat === s.winner ? 1 : 0)) };
}

/** Each side's choice stays hidden from the other until both are in; the Rng is the table's. */
function view(s: State, seat: number | null): State {
  return {
    ...s,
    shot: s.shot === null || seat === shooterOf(s) ? s.shot : SECRET,
    dive: s.dive === null || seat === keeperOf(s) ? s.dive : SECRET,
    rng: [0, 0, 0, 0],
  };
}

function viewAction(action: Action, seat: number, viewer: number | null): Action | null {
  return viewer === seat ? action : null;
}

export const engine: TurnEngine<State, Action, unknown> = {
  initialState,
  legalActions,
  applyAction,
  currentSeats,
  result,
  view,
  viewAction,
};
