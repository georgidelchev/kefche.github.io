// Lowest Unique Number (SPEC §20.4 #58): 2–10 players, 5 or 10 rounds.
// Each round everyone picks a number from 1 to 10, at once and in secret.
// The lowest number nobody else picked wins the round and scores a point;
// if every number was picked more than once, nobody scores. The most
// points win; a tie is shared.
// A pick stays hidden until everyone has picked, so online the table holds
// it (ADR-0047).
import type { GameResult, TurnEngine } from "@kefche/game-sdk";

export interface Config {
  rounds: 5 | 10;
}

export function configFrom(raw: unknown): Config {
  return { rounds: (raw as { rounds?: unknown } | undefined)?.rounds === 10 ? 10 : 5 };
}

export const MAX = 10;
/** A pick made but not shown yet (in a view). */
export const SECRET = -1;

export interface Round {
  picks: number[];
  /** The seat with the lowest unique number, or null. */
  winner: number | null;
}

export interface State {
  players: number;
  config: Config;
  /** This round's picks: null not yet, SECRET hidden in a view. */
  picks: (number | null)[];
  history: Round[];
  scores: number[];
  moves: number;
}

export interface Action {
  pick: number;
}

/** The seat whose number nobody else picked, lowest first, or null. */
export function lowestUnique(picks: readonly number[]): number | null {
  let best: number | null = null;
  picks.forEach((n, seat) => {
    const unique = picks.filter((m) => m === n).length === 1;
    if (unique && (best === null || n < (picks[best] ?? Infinity))) best = seat;
  });
  return best;
}

function initialState(config: Config, seats: number): State {
  return {
    players: seats,
    config,
    picks: Array.from({ length: seats }, () => null),
    history: [],
    scores: Array.from({ length: seats }, () => 0),
    moves: 0,
  };
}

const over = (s: State) => s.history.length >= s.config.rounds;

function legalActions(s: State, seat: number): Action[] {
  if (over(s) || s.picks[seat] !== null) return [];
  return Array.from({ length: MAX }, (_, i) => ({ pick: i + 1 }));
}

function applyAction(s: State, seat: number, action: Action): State {
  if (over(s) || s.picks[seat] !== null) return s;
  if (!Number.isInteger(action.pick) || action.pick < 1 || action.pick > MAX) return s;
  const picks = s.picks.map((p, i) => (i === seat ? action.pick : p));
  if (picks.some((p) => p === null)) return { ...s, picks, moves: s.moves + 1 };
  const all = picks.map((p) => p ?? 0);
  const winner = lowestUnique(all);
  return {
    ...s,
    picks: picks.map(() => null),
    history: [...s.history, { picks: all, winner }],
    scores: s.scores.map((v, i) => (i === winner ? v + 1 : v)),
    moves: s.moves + 1,
  };
}

function currentSeats(s: State): number[] {
  return over(s) ? [] : s.picks.flatMap((p, seat) => (p === null ? [seat] : []));
}

function result(s: State): GameResult | null {
  if (!over(s)) return null;
  const best = Math.max(...s.scores);
  const top = s.scores.filter((v) => v === best).length;
  return {
    completed: true,
    outcome: s.scores.map((v) => (v === best ? (top === 1 ? 1 : 0.5) : 0)),
  };
}

/** Other players' picks stay hidden until the round is over. */
function view(s: State, seat: number | null): State {
  return { ...s, picks: s.picks.map((p, i) => (p === null || i === seat ? p : SECRET)) };
}

function viewAction(action: Action, seat: number, viewer: number | null): Action | null {
  return viewer === seat ? action : null;
}

export const engine: TurnEngine<State, Action, Config> = {
  initialState,
  legalActions,
  applyAction,
  currentSeats,
  result,
  view,
  viewAction,
};
