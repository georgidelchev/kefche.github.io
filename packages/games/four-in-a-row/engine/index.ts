// Four in a Row rules (SPEC §20.4 #85): players take turns dropping a disc
// into a column, where it falls to the lowest free cell. Four of your discs
// in a row, across, up or diagonally, wins; a full board is a draw. With 3
// or 4 players the board is bigger and the goal stays four. Pure and
// deterministic: no randomness at all.
import type { GameResult, TurnEngine } from "@kefche/game-sdk";

export const WIN_LENGTH = 4;

/** Columns × rows per number of players. */
const SIZES: Readonly<Record<number, readonly [number, number]>> = {
  2: [7, 6],
  3: [9, 7],
  4: [10, 8],
};
export const sizeFor = (seats: number): readonly [number, number] => SIZES[seats] ?? [7, 6];

export interface State {
  cols: number;
  rows: number;
  seats: number;
  /** `cells[col * rows + row]`, row 0 at the bottom: -1 when empty, else the seat. */
  cells: number[];
  /** Discs in each column. */
  heights: number[];
  turn: number;
  moves: number;
  winner: number | null;
  /** Cells of the winning line, empty until someone wins. */
  line: number[];
}

export interface Action {
  column: number;
}

const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;

export const cellAt = (state: State, col: number, row: number) => col * state.rows + row;

/** The run of `seat`'s discs through (col, row) that reaches four, or null. */
export function lineThrough(
  state: Pick<State, "cols" | "rows" | "cells">,
  col: number,
  row: number,
  seat: number,
): number[] | null {
  const { cols, rows, cells } = state;
  for (const [dc, dr] of DIRECTIONS) {
    const line = [col * rows + row];
    for (const sign of [1, -1]) {
      let c = col + dc * sign;
      let r = row + dr * sign;
      while (c >= 0 && c < cols && r >= 0 && r < rows && cells[c * rows + r] === seat) {
        line.push(c * rows + r);
        c += dc * sign;
        r += dr * sign;
      }
    }
    if (line.length >= WIN_LENGTH) return line;
  }
  return null;
}

/** Would `seat` win by dropping into `column` now (whoever's turn it is)? */
export function winsWith(state: State, column: number, seat: number): boolean {
  const row = state.heights[column];
  if (row === undefined || row >= state.rows) return false;
  const cells = state.cells.slice();
  cells[column * state.rows + row] = seat;
  return lineThrough({ ...state, cells }, column, row, seat) !== null;
}

export const isOver = (state: State) =>
  state.winner !== null || state.moves === state.cols * state.rows;

export const engine: TurnEngine<State, Action> = {
  initialState(_config, seats) {
    const [cols, rows] = sizeFor(seats);
    return {
      cols,
      rows,
      seats,
      cells: Array.from({ length: cols * rows }, () => -1),
      heights: Array.from({ length: cols }, () => 0),
      turn: 0,
      moves: 0,
      winner: null,
      line: [],
    };
  },

  legalActions(state, seat) {
    if (seat !== state.turn || isOver(state)) return [];
    return state.heights.flatMap((h, column) => (h < state.rows ? [{ column }] : []));
  },

  applyAction(state, seat, { column }) {
    if (seat !== state.turn || isOver(state)) return state;
    const row = state.heights[column];
    if (row === undefined || row >= state.rows) return state;
    const cells = state.cells.slice();
    cells[column * state.rows + row] = seat;
    const heights = state.heights.slice();
    heights[column] = row + 1;
    const next: State = {
      ...state,
      cells,
      heights,
      moves: state.moves + 1,
      turn: (state.turn + 1) % state.seats,
    };
    const line = lineThrough(next, column, row, seat);
    return line ? { ...next, winner: seat, line } : next;
  },

  currentSeats: (state) => (isOver(state) ? [] : [state.turn]),

  // Online, an away player's turn passes to the next seat.
  skipTurn: (state, seat) =>
    seat !== state.turn || isOver(state)
      ? state
      : { ...state, turn: (state.turn + 1) % state.seats },

  result(state): GameResult | null {
    if (state.winner !== null) {
      const winner = state.winner;
      return {
        completed: true,
        outcome: Array.from({ length: state.seats }, (_, i) => (i === winner ? 1 : 0)),
      };
    }
    if (isOver(state)) {
      return { completed: true, outcome: Array.from({ length: state.seats }, () => 0.5) };
    }
    return null;
  },
};
