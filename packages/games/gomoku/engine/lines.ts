// A line game on a square grid (SPEC §20.1 #8 Gomoku, §20.9 #86 Five
// Colors): players take turns placing a stone on an empty point, and the
// first to make an unbroken line of `line` stones (across, down or diagonal)
// wins. With `exact`, a longer line doesn't count. A full board is a draw.
// Shared by Gomoku and Five Colors. Pure and deterministic.
import type { GameResult, TurnEngine } from "@kefche/game-sdk";

export interface LineRules {
  size: number;
  /** Stones in a row that win. */
  line: number;
  /** Only exactly `line` wins (Gomoku's "exactly five"). */
  exact: boolean;
}

export interface Action {
  point: number;
}

export interface State extends LineRules {
  seats: number;
  /** `board[row * size + col]`: -1 empty, else the seat. */
  board: number[];
  turn: number;
  moves: number;
  last: number | null;
  over: boolean;
  winner: number | null;
  /** The winning line's points. */
  winLine: number[];
}

export const EMPTY = -1;
export const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;

/** The run of `seat`'s stones through `point` along (dr, dc), as points, in order. */
export function runThrough(
  state: Pick<State, "board" | "size">,
  point: number,
  seat: number,
  dr: number,
  dc: number,
): number[] {
  const { board, size } = state;
  const r0 = Math.floor(point / size);
  const c0 = point % size;
  const run = [point];
  for (const sign of [-1, 1]) {
    let r = r0 + sign * dr;
    let c = c0 + sign * dc;
    while (r >= 0 && r < size && c >= 0 && c < size && board[r * size + c] === seat) {
      if (sign < 0) run.unshift(r * size + c);
      else run.push(r * size + c);
      r += sign * dr;
      c += sign * dc;
    }
  }
  return run;
}

/** The winning line `point` completes for `seat`, or null. */
export function winningLine(
  state: Pick<State, "board" | "size" | "line" | "exact">,
  point: number,
  seat: number,
): number[] | null {
  for (const [dr, dc] of DIRECTIONS) {
    const run = runThrough(state, point, seat, dr, dc);
    if (state.exact ? run.length === state.line : run.length >= state.line) return run;
  }
  return null;
}

export function lineEngine(
  rulesFor: (config: unknown, seats: number) => LineRules,
): TurnEngine<State, Action, unknown> {
  return {
    initialState(config, seats) {
      const rules = rulesFor(config, seats);
      return {
        ...rules,
        seats,
        board: Array.from({ length: rules.size * rules.size }, () => EMPTY),
        turn: 0,
        moves: 0,
        last: null,
        over: false,
        winner: null,
        winLine: [],
      };
    },

    legalActions(state, seat) {
      if (state.over || seat !== state.turn) return [];
      return state.board.flatMap((v, point) => (v === EMPTY ? [{ point }] : []));
    },

    applyAction(state, seat, { point }) {
      if (
        state.over ||
        seat !== state.turn ||
        !Number.isInteger(point) ||
        state.board[point] !== EMPTY
      ) {
        return state;
      }
      const board = state.board.slice();
      board[point] = seat;
      const placed = { ...state, board, moves: state.moves + 1, last: point };
      const won = winningLine(placed, point, seat);
      if (won) return { ...placed, over: true, winner: seat, winLine: won };
      if (placed.moves === board.length) return { ...placed, over: true };
      return { ...placed, turn: (seat + 1) % state.seats };
    },

    currentSeats: (state) => (state.over ? [] : [state.turn]),

    // Online, an away player's turn passes to the next seat.
    skipTurn(state, seat) {
      if (state.over || seat !== state.turn) return state;
      return { ...state, turn: (seat + 1) % state.seats, last: null };
    },

    result(state): GameResult | null {
      if (!state.over) return null;
      const outcome = Array.from({ length: state.seats }, (_, s) =>
        state.winner === null ? 1 / state.seats : s === state.winner ? 1 : 0,
      );
      // A full board with no line is a draw for everyone.
      return { completed: true, outcome: state.winner === null ? outcome.map(() => 0.5) : outcome };
    },
  };
}
