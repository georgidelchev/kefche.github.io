// Hex rules (SPEC §20.1 #9): an 11 × 11 rhombus of hexagons. The first
// player (seat 0) joins the top and bottom edges, the second (seat 1) the
// left and right. Players take turns placing a stone on an empty cell; the
// first to connect their two edges with a chain of their stones wins. A
// full board always has a winner, so there are no draws.
//
// With the swap rule (an option, off by default), the second player may,
// instead of their first move, take over the first stone: it is mirrored
// across the long diagonal and becomes theirs, and the first player moves
// again. That stops the first player from simply taking the centre.
import type { GameResult, TurnEngine } from "@kefche/game-sdk";

export const SIZE = 11;
export const EMPTY = -1;

export interface Config {
  swap: boolean;
}

export type Action = { type: "play"; cell: number } | { type: "swap" };

export interface State {
  size: number;
  /** `board[row * size + col]`: -1 empty, else the seat. */
  board: number[];
  turn: number;
  moves: number;
  swapRule: boolean;
  swapped: boolean;
  last: number | null;
  winner: number | null;
  /** The winning chain's cells. */
  chain: number[];
}

export const configFrom = (raw: unknown): Config => ({
  swap: (raw as { swap?: unknown } | null | undefined)?.swap === true,
});

const neighbourCache = new Map<number, number[][]>();
/** Each cell's neighbours: up, up-right, left, right, down-left, down. */
export function neighbours(size: number): number[][] {
  const known = neighbourCache.get(size);
  if (known) return known;
  const steps = [
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
  ] as const;
  const table = Array.from({ length: size * size }, (_, cell) => {
    const r = Math.floor(cell / size);
    const c = cell % size;
    return steps.flatMap(([dr, dc]) => {
      const rr = r + dr;
      const cc = c + dc;
      return rr >= 0 && rr < size && cc >= 0 && cc < size ? [rr * size + cc] : [];
    });
  });
  neighbourCache.set(size, table);
  return table;
}

/**
 * The chain joining `seat`'s two edges, or null: seat 0 from row 0 to the
 * last row, seat 1 from column 0 to the last column.
 */
export function winningChain(
  board: ArrayLike<number>,
  size: number,
  seat: number,
): number[] | null {
  const table = neighbours(size);
  const from = new Int16Array(size * size).fill(-2);
  const queue: number[] = [];
  for (let i = 0; i < size; i++) {
    const cell = seat === 0 ? i : i * size;
    if (board[cell] === seat) {
      from[cell] = -1;
      queue.push(cell);
    }
  }
  while (queue.length > 0) {
    const cell = queue.shift() ?? 0;
    const r = Math.floor(cell / size);
    const c = cell % size;
    if ((seat === 0 && r === size - 1) || (seat === 1 && c === size - 1)) {
      const chain = [cell];
      let at = from[cell] ?? -1;
      while (at >= 0) {
        chain.push(at);
        at = from[at] ?? -1;
      }
      return chain;
    }
    for (const n of table[cell] ?? []) {
      if (board[n] === seat && from[n] === -2) {
        from[n] = cell;
        queue.push(n);
      }
    }
  }
  return null;
}

/** The cell mirrored across the long diagonal (row and column swapped). */
export const mirror = (cell: number, size: number) =>
  (cell % size) * size + Math.floor(cell / size);

export const engine: TurnEngine<State, Action, Config | undefined> = {
  initialState(config) {
    return {
      size: SIZE,
      board: Array.from({ length: SIZE * SIZE }, () => EMPTY),
      turn: 0,
      moves: 0,
      swapRule: configFrom(config).swap,
      swapped: false,
      last: null,
      winner: null,
      chain: [],
    };
  },

  legalActions(state, seat) {
    if (state.winner !== null || seat !== state.turn) return [];
    const plays = state.board.flatMap((v, cell) =>
      v === EMPTY ? [{ type: "play", cell } as const] : [],
    );
    return state.swapRule && state.moves === 1 && seat === 1 ? [{ type: "swap" }, ...plays] : plays;
  },

  applyAction(state, seat, action) {
    if (state.winner !== null || seat !== state.turn) return state;
    const other = 1 - seat;
    if (action.type === "swap") {
      if (!state.swapRule || state.moves !== 1 || seat !== 1 || state.last === null) return state;
      const board = state.board.map(() => EMPTY);
      const cell = mirror(state.last, state.size);
      board[cell] = 1;
      return { ...state, board, turn: other, moves: state.moves + 1, swapped: true, last: cell };
    }
    if (!Number.isInteger(action.cell) || state.board[action.cell] !== EMPTY) {
      return state;
    }
    const board = state.board.slice();
    board[action.cell] = seat;
    const chain = winningChain(board, state.size, seat);
    const base = { ...state, board, moves: state.moves + 1, last: action.cell };
    if (chain) return { ...base, winner: seat, chain };
    return { ...base, turn: other };
  },

  currentSeats: (state) => (state.winner === null ? [state.turn] : []),

  // Online, an away player's turn passes to the other.
  skipTurn(state, seat) {
    if (state.winner !== null || seat !== state.turn) return state;
    return { ...state, turn: 1 - seat, last: null };
  },

  result(state): GameResult | null {
    if (state.winner === null) return null;
    return { completed: true, outcome: state.winner === 0 ? [1, 0] : [0, 1] };
  },
};
