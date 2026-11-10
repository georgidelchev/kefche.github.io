// Ultimate Tic-Tac-Toe rules (SPEC §20.9 #90), with classic tic-tac-toe as
// a mode. Ultimate: nine small boards in a 3 × 3 grid. The cell you play in
// sends your opponent to the small board in the same position; if that
// board is won or full, they may play in any open board. Three in a row
// wins a small board, and three won boards in a row win the game. A board
// that fills with no line counts for nobody; no line of boards at the end is
// a draw. Classic: one 3 × 3 board, three in a row wins. Pure and
// deterministic.
import type { GameResult, TurnEngine } from "@kefche/game-sdk";

export type Mode = "ultimate" | "classic";

export interface Config {
  mode: Mode;
}

export interface Action {
  /** Ultimate: board * 9 + cell (0–80); classic: the cell (0–8). */
  cell: number;
}

export interface State {
  mode: Mode;
  /** -1 empty, else the seat. */
  cells: number[];
  /** Ultimate: each small board's state: -1 open, 0 or 1 won, 2 full with no line. */
  boards: number[];
  /** Ultimate: the board the player to move must play in, or null for any open one. */
  next: number | null;
  turn: number;
  moves: number;
  last: number | null;
  winner: number | null;
  over: boolean;
  /** The winning line: cells (classic) or boards (ultimate). */
  line: number[];
}

export const EMPTY = -1;
export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const configFrom = (raw: unknown): Config => ({
  mode: (raw as { mode?: unknown } | null | undefined)?.mode === "classic" ? "classic" : "ultimate",
});

/** The line `seat` holds among these nine marks, or null. */
export function lineOf(marks: readonly number[], seat: number): number[] | null {
  for (const line of LINES) if (line.every((i) => marks[i] === seat)) return [...line];
  return null;
}

/** Ultimate: board `b`'s nine cells. */
export const smallBoard = (cells: readonly number[], b: number) => cells.slice(b * 9, b * 9 + 9);

export function movesFor(state: State): number[] {
  if (state.over) return [];
  if (state.mode === "classic") return state.cells.flatMap((v, i) => (v === EMPTY ? [i] : []));
  const open = (b: number) => state.boards[b] === EMPTY;
  const allowed =
    state.next !== null && open(state.next)
      ? [state.next]
      : [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(open);
  return allowed.flatMap((b) =>
    smallBoard(state.cells, b).flatMap((v, c) => (v === EMPTY ? [b * 9 + c] : [])),
  );
}

export const engine: TurnEngine<State, Action, Config | undefined> = {
  initialState(config) {
    const { mode } = configFrom(config);
    return {
      mode,
      cells: Array.from({ length: mode === "classic" ? 9 : 81 }, () => EMPTY),
      boards: Array.from({ length: 9 }, () => EMPTY),
      next: null,
      turn: 0,
      moves: 0,
      last: null,
      winner: null,
      over: false,
      line: [],
    };
  },

  legalActions(state, seat) {
    if (seat !== state.turn) return [];
    return movesFor(state).map((cell) => ({ cell }));
  },

  applyAction(state, seat, { cell }) {
    if (seat !== state.turn || !movesFor(state).includes(cell)) return state;
    const cells = state.cells.slice();
    cells[cell] = seat;
    const base = { ...state, cells, moves: state.moves + 1, last: cell, turn: 1 - seat };
    if (state.mode === "classic") {
      const line = lineOf(cells, seat);
      if (line) return { ...base, turn: seat, winner: seat, over: true, line };
      if (cells.every((v) => v !== EMPTY)) return { ...base, turn: seat, over: true };
      return base;
    }
    const board = Math.floor(cell / 9);
    const boards = state.boards.slice();
    const small = smallBoard(cells, board);
    if (lineOf(small, seat)) boards[board] = seat;
    else if (small.every((v) => v !== EMPTY)) boards[board] = 2;
    const next = cell % 9;
    const after = { ...base, boards, next };
    const line = lineOf(boards, seat);
    if (line) return { ...after, turn: seat, winner: seat, over: true, line };
    if (boards.every((b) => b !== EMPTY)) return { ...after, turn: seat, over: true };
    return after;
  },

  currentSeats: (state) => (state.over ? [] : [state.turn]),

  // Online, an away player's turn passes.
  skipTurn(state, seat) {
    if (state.over || seat !== state.turn) return state;
    return { ...state, turn: 1 - seat, last: null };
  },

  result(state): GameResult | null {
    if (!state.over) return null;
    const outcome = state.winner === null ? [0.5, 0.5] : state.winner === 0 ? [1, 0] : [0, 1];
    return { completed: true, outcome };
  },
};
