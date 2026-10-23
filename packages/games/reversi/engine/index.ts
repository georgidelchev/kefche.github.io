// Reversi rules (SPEC §20.4 #5): an 8 × 8 board with two discs each in the
// centre; the first seat moves first. A move places a disc so that it
// brackets a straight line of the other player's discs, which all flip. A
// player with no legal move passes automatically; when neither can move, the
// game ends and the most discs wins. Pure and deterministic.
import type { GameResult, TurnEngine } from "@kefche/game-sdk";

export const SIZE = 8;

export interface State {
  /** `board[row * 8 + col]`, row 0 at the top: -1 when empty, else the seat (0 or 1). */
  board: number[];
  turn: number;
  moves: number;
  /** Square of the last disc placed, or null. */
  last: number | null;
  /** Squares flipped by the last move. */
  flipped: number[];
  /** The seat that had no move and passed after the last move, or null. */
  passed: number | null;
  over: boolean;
}

export interface Action {
  square: number;
}

const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const;

/** Discs `seat` would flip by playing `square`; empty when the move is illegal. */
export function flipsFor(board: readonly number[], square: number, seat: number): number[] {
  if (board[square] !== -1) return [];
  const row = Math.floor(square / SIZE);
  const col = square % SIZE;
  const flips: number[] = [];
  for (const [dr, dc] of DIRECTIONS) {
    const line: number[] = [];
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
      const v = board[r * SIZE + c];
      if (v === -1) break;
      if (v === seat) {
        flips.push(...line);
        break;
      }
      line.push(r * SIZE + c);
      r += dr;
      c += dc;
    }
  }
  return flips;
}

/** Squares where `seat` can play, whoever's turn it is. */
export function movesFor(board: readonly number[], seat: number): number[] {
  const moves: number[] = [];
  for (let square = 0; square < SIZE * SIZE; square++) {
    if (board[square] === -1 && flipsFor(board, square, seat).length > 0) moves.push(square);
  }
  return moves;
}

export const countDiscs = (board: readonly number[], seat: number) =>
  board.reduce((n, v) => (v === seat ? n + 1 : n), 0);

export const engine: TurnEngine<State, Action> = {
  initialState() {
    const board = Array.from({ length: SIZE * SIZE }, () => -1);
    board[3 * SIZE + 3] = 1;
    board[3 * SIZE + 4] = 0;
    board[4 * SIZE + 3] = 0;
    board[4 * SIZE + 4] = 1;
    return { board, turn: 0, moves: 0, last: null, flipped: [], passed: null, over: false };
  },

  legalActions(state, seat) {
    if (state.over || seat !== state.turn) return [];
    return movesFor(state.board, seat).map((square) => ({ square }));
  },

  applyAction(state, seat, { square }) {
    if (state.over || seat !== state.turn || !Number.isInteger(square)) return state;
    const flipped = flipsFor(state.board, square, seat);
    if (flipped.length === 0) return state;
    const board = state.board.slice();
    board[square] = seat;
    for (const f of flipped) board[f] = seat;
    const other = 1 - seat;
    const base = { ...state, board, moves: state.moves + 1, last: square, flipped };
    if (movesFor(board, other).length > 0) return { ...base, turn: other, passed: null };
    if (movesFor(board, seat).length > 0) return { ...base, turn: seat, passed: other };
    return { ...base, passed: null, over: true };
  },

  currentSeats: (state) => (state.over ? [] : [state.turn]),

  result(state): GameResult | null {
    if (!state.over) return null;
    const a = countDiscs(state.board, 0);
    const b = countDiscs(state.board, 1);
    return { completed: true, outcome: a === b ? [0.5, 0.5] : a > b ? [1, 0] : [0, 1] };
  },
};
