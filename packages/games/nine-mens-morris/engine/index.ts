// Nine Men's Morris rules (SPEC §20.1 #7): 24 points on three nested squares.
// Each player first places nine pieces, one per turn, then moves a piece to
// a neighbouring empty point. Three of your pieces in a line (a mill) let you
// remove one of the other player's pieces, never one in a mill unless all of
// them are. With the flying option (on by default), a player down to three
// pieces may move to any empty point. A player left with two pieces, or with
// no move, loses. A draw at the third repetition of a position, or after 50
// moves in a row without a removal once the pieces are all placed.
//
// A turn is one action: where the piece goes (from a point, or placed), and
// which piece it removes when it closes a mill. Pure and deterministic.
import type { GameResult, TurnEngine } from "@kefche/game-sdk";

export interface Config {
  flying: boolean;
}

export interface Action {
  /** The point the piece leaves; null while placing. */
  from: number | null;
  to: number;
  /** The other player's piece taken when the move closes a mill. */
  remove: number | null;
}

export interface State {
  /** 24 points: -1 empty, else the seat. */
  board: number[];
  turn: number;
  moves: number;
  /** Pieces each seat still has to place. */
  inHand: [number, number];
  flying: boolean;
  last: Action | null;
  /** Moves in a row without a removal, once every piece is placed. */
  quiet: number;
  /** Positions since the last removal, for repetition. */
  seen: string[];
  over: boolean;
  winner: number | null;
}

export const POINTS = 24;
export const EMPTY = -1;
export const QUIET_LIMIT = 50;

/** Where each point sits on a 7 × 7 grid, for drawing: [column, row]. */
export const COORDS: readonly (readonly [number, number])[] = [
  [0, 0],
  [3, 0],
  [6, 0],
  [1, 1],
  [3, 1],
  [5, 1],
  [2, 2],
  [3, 2],
  [4, 2],
  [0, 3],
  [1, 3],
  [2, 3],
  [4, 3],
  [5, 3],
  [6, 3],
  [2, 4],
  [3, 4],
  [4, 4],
  [1, 5],
  [3, 5],
  [5, 5],
  [0, 6],
  [3, 6],
  [6, 6],
];

export const ADJACENT: readonly (readonly number[])[] = [
  [1, 9],
  [0, 2, 4],
  [1, 14],
  [4, 10],
  [1, 3, 5, 7],
  [4, 13],
  [7, 11],
  [4, 6, 8],
  [7, 12],
  [0, 10, 21],
  [3, 9, 11, 18],
  [6, 10, 15],
  [8, 13, 17],
  [5, 12, 14, 20],
  [2, 13, 23],
  [11, 16],
  [15, 17, 19],
  [12, 16],
  [10, 19],
  [16, 18, 20, 22],
  [13, 19],
  [9, 22],
  [19, 21, 23],
  [14, 22],
];

export const MILLS: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [9, 10, 11],
  [12, 13, 14],
  [15, 16, 17],
  [18, 19, 20],
  [21, 22, 23],
  [0, 9, 21],
  [3, 10, 18],
  [6, 11, 15],
  [1, 4, 7],
  [16, 19, 22],
  [8, 12, 17],
  [5, 13, 20],
  [2, 14, 23],
];

const MILLS_AT: readonly (readonly (readonly [number, number, number])[])[] = Array.from(
  { length: POINTS },
  (_, p) => MILLS.filter((m) => m.includes(p)),
);

export const inMill = (board: readonly number[], point: number) => {
  const seat = board[point];
  return seat !== EMPTY && (MILLS_AT[point] ?? []).some((m) => m.every((q) => board[q] === seat));
};

export const countOf = (board: readonly number[], seat: number) =>
  board.reduce((n, v) => (v === seat ? n + 1 : n), 0);

/** The config from a setup or room: flying unless it says otherwise. */
export function configFrom(raw: unknown): Config {
  const flying = (raw as { flying?: unknown } | null | undefined)?.flying;
  return { flying: flying !== false };
}

/** The other player's pieces `seat` may remove: none in a mill, unless all are. */
export function removable(board: readonly number[], seat: number): number[] {
  const theirs: number[] = [];
  board.forEach((v, p) => {
    if (v === 1 - seat) theirs.push(p);
  });
  const free = theirs.filter((p) => !inMill(board, p));
  return free.length > 0 ? free : theirs;
}

const canFly = (state: State, seat: number) =>
  state.flying && state.inHand[seat] === 0 && countOf(state.board, seat) === 3;

/** Where the pieces go this turn (before any removal): [from, to] pairs. */
function steps(state: State, seat: number): [number | null, number][] {
  const { board } = state;
  if ((state.inHand[seat] ?? 0) > 0) {
    return board.flatMap((v, p) => (v === EMPTY ? [[null, p] as [null, number]] : []));
  }
  const out: [number, number][] = [];
  const fly = canFly(state, seat);
  board.forEach((v, p) => {
    if (v !== seat) return;
    const targets = fly
      ? board.flatMap((w, q) => (w === EMPTY ? [q] : []))
      : (ADJACENT[p] ?? []).filter((q) => board[q] === EMPTY);
    for (const q of targets) out.push([p, q]);
  });
  return out;
}

export function movesFor(state: State, seat: number): Action[] {
  const out: Action[] = [];
  for (const [from, to] of steps(state, seat)) {
    const board = state.board.slice();
    if (from !== null) board[from] = EMPTY;
    board[to] = seat;
    if (inMill(board, to)) {
      for (const remove of removable(board, seat)) out.push({ from, to, remove });
    } else out.push({ from, to, remove: null });
  }
  return out;
}

const key = (state: Pick<State, "board" | "turn" | "inHand">) =>
  `${String(state.turn)}${state.inHand.join("")}:${state.board.map((v) => String(v + 1)).join("")}`;

export const engine: TurnEngine<State, Action, Config | undefined> = {
  initialState(config) {
    const { flying } = configFrom(config);
    const board = Array.from({ length: POINTS }, () => EMPTY);
    const state: State = {
      board,
      turn: 0,
      moves: 0,
      inHand: [9, 9],
      flying,
      last: null,
      quiet: 0,
      seen: [],
      over: false,
      winner: null,
    };
    return { ...state, seen: [key(state)] };
  },

  legalActions(state, seat) {
    if (state.over || seat !== state.turn) return [];
    return movesFor(state, seat);
  },

  applyAction(state, seat, action) {
    if (state.over || seat !== state.turn) return state;
    const move = movesFor(state, seat).find(
      (m) => m.from === action.from && m.to === action.to && m.remove === action.remove,
    );
    if (!move) return state;
    const board = state.board.slice();
    if (move.from !== null) board[move.from] = EMPTY;
    board[move.to] = seat;
    if (move.remove !== null) board[move.remove] = EMPTY;
    const inHand: [number, number] = [state.inHand[0], state.inHand[1]];
    if (move.from === null) inHand[seat === 0 ? 0 : 1] -= 1;
    const other = 1 - seat;
    const placing = inHand[0] > 0 || inHand[1] > 0;
    const quiet = move.remove !== null || placing ? 0 : state.quiet + 1;
    const next: State = {
      ...state,
      board,
      inHand,
      turn: other,
      moves: state.moves + 1,
      last: move,
      quiet,
    };
    const k = key(next);
    const seen = move.remove !== null || move.from === null ? [k] : [...state.seen, k];
    const done = { ...next, seen };
    // Two pieces left (once placed), or nothing to move: the other side has lost.
    if (inHand[other] === 0 && countOf(board, other) < 3)
      return { ...done, over: true, winner: seat };
    if (movesFor(done, other).length === 0) return { ...done, over: true, winner: seat };
    if (seen.filter((s) => s === k).length >= 3 || quiet >= QUIET_LIMIT) {
      return { ...done, over: true, winner: null };
    }
    return done;
  },

  currentSeats: (state) => (state.over ? [] : [state.turn]),

  // Online, an away player's turn passes, if the other player can move.
  skipTurn(state, seat) {
    const other = 1 - seat;
    if (state.over || seat !== state.turn || movesFor(state, other).length === 0) return state;
    return { ...state, turn: other, last: null };
  },

  result(state): GameResult | null {
    if (!state.over) return null;
    const outcome = state.winner === null ? [0.5, 0.5] : state.winner === 0 ? [1, 0] : [0, 1];
    return { completed: true, outcome };
  },
};
