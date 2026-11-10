// Checkers rules (SPEC §20.1 #2), in two variants:
// - International: 10 × 10, 20 pieces each, and a capture must take the most
//   pieces possible.
// - Russian: 8 × 8, 12 pieces each; any capture may be chosen, and a man that
//   reaches the far row mid-capture is crowned and goes on as a king.
// Both: pieces stand on the dark squares; the light pieces (seat 0) move
// first, up the board. Men step diagonally forward and capture forward or
// backward; kings fly along diagonals. Capturing is mandatory and a capture
// goes on while it can; captured pieces leave the board only when the move
// ends, and none is jumped twice. A player with no move loses. A draw at the
// third repetition of a position, or after 25 moves each with only kings
// moving and nothing captured. Pure and deterministic.
import type { GameResult, TurnEngine } from "@kefche/game-sdk";

export const VARIANTS = ["russian", "international"] as const;
export type Variant = (typeof VARIANTS)[number];

export interface Config {
  variant: Variant;
}

/** Board cells: -1 empty, else seat * 2 + (king ? 1 : 0). */
export const EMPTY = -1;
export const seatOf = (piece: number) => piece >> 1;
export const isKing = (piece: number) => (piece & 1) === 1;

export interface Move {
  /** The squares the piece stands on, from its start to where it ends. */
  path: number[];
  /** Squares of the pieces it takes, in order. */
  captures: number[];
}

export interface Action {
  path: number[];
}

export interface State {
  variant: Variant;
  size: number;
  /** `board[row * size + col]`, row 0 at the top. */
  board: number[];
  turn: number;
  moves: number;
  last: Move | null;
  /** Moves in a row with only kings moving and nothing captured. */
  quiet: number;
  /** Positions since the last capture or man move, for repetition. */
  seen: string[];
  over: boolean;
  /** The winner once over; null for a draw. */
  winner: number | null;
}

/** 25 moves each (SPEC catalog: the usual tournament rule). */
export const QUIET_LIMIT = 50;

export const sizeOf = (variant: Variant) => (variant === "international" ? 10 : 8);
export const isDark = (square: number, size: number) =>
  (Math.floor(square / size) + (square % size)) % 2 === 1;

const DIAGONALS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

/** The variant from a config (a room's or the setup's); anything else plays Russian. */
export function configFrom(raw: unknown): Config {
  const variant = (raw as { variant?: unknown } | null | undefined)?.variant;
  return { variant: VARIANTS.find((v) => v === variant) ?? "russian" };
}

/** Rows toward which a seat's men move: seat 0 up the board, seat 1 down. */
const forward = (seat: number) => (seat === 0 ? -1 : 1);
const farRow = (seat: number, size: number) => (seat === 0 ? 0 : size - 1);

function step(square: number, size: number, dr: number, dc: number): number | null {
  const r = Math.floor(square / size) + dr;
  const c = (square % size) + dc;
  return r >= 0 && r < size && c >= 0 && c < size ? r * size + c : null;
}

/**
 * Every capture sequence from `from`, each going on for as long as it can.
 * A king that takes a piece may land on any empty square beyond it, but if
 * some of those squares lead to a further capture, it must land on one of them.
 */
function captures(state: Pick<State, "board" | "size" | "variant">, from: number): Move[] {
  const { board, size, variant } = state;
  const piece = board[from] ?? EMPTY;
  const seat = seatOf(piece);
  // The moving piece has left its square, and taken pieces stay until the end.
  const empty = (sq: number) => board[sq] === EMPTY || sq === from;
  const walk = (at: number, king: boolean, path: number[], taken: number[]): Move[] => {
    const found: Move[] = [];
    for (const [dr, dc] of DIAGONALS) {
      let sq = step(at, size, dr, dc);
      // Flying: over empty squares to the first piece.
      while (king && sq !== null && empty(sq)) sq = step(sq, size, dr, dc);
      if (sq === null) continue;
      const target = board[sq] ?? EMPTY;
      if (empty(sq) || seatOf(target) === seat || taken.includes(sq)) continue;
      const lines: Move[][] = [];
      let land = step(sq, size, dr, dc);
      while (land !== null && empty(land)) {
        const crowned =
          king || (variant === "russian" && Math.floor(land / size) === farRow(seat, size));
        const next = walk(land, crowned, [...path, land], [...taken, sq]);
        lines.push(next.length > 0 ? next : [{ path: [...path, land], captures: [...taken, sq] }]);
        if (!king) break;
        land = step(land, size, dr, dc);
      }
      const onward = lines.filter((line) => line.some((m) => m.captures.length > taken.length + 1));
      for (const line of onward.length > 0 ? onward : lines) found.push(...line);
    }
    return found;
  };
  return walk(from, isKing(piece), [from], []);
}

/** Quiet moves (no capture) of the piece on `from`. */
function steps(state: Pick<State, "board" | "size">, from: number): Move[] {
  const { board, size } = state;
  const piece = board[from] ?? EMPTY;
  const seat = seatOf(piece);
  const out: Move[] = [];
  for (const [dr, dc] of DIAGONALS) {
    if (!isKing(piece) && dr !== forward(seat)) continue;
    let sq = step(from, size, dr, dc);
    while (sq !== null && board[sq] === EMPTY) {
      out.push({ path: [from, sq], captures: [] });
      if (!isKing(piece)) break;
      sq = step(sq, size, dr, dc);
    }
  }
  return out;
}

/** Every legal move for `seat`: captures if there are any (the longest, in International). */
export function movesFor(state: Pick<State, "board" | "size" | "variant">, seat: number): Move[] {
  const own: number[] = [];
  state.board.forEach((piece, square) => {
    if (piece !== EMPTY && seatOf(piece) === seat) own.push(square);
  });
  const taking = own.flatMap((square) => captures(state, square));
  if (taking.length > 0) {
    if (state.variant !== "international") return taking;
    const most = Math.max(...taking.map((m) => m.captures.length));
    return taking.filter((m) => m.captures.length === most);
  }
  return own.flatMap((square) => steps(state, square));
}

const samePath = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const positionKey = (board: readonly number[], turn: number) =>
  `${String(turn)}:${board.map((v) => String(v + 1)).join("")}`;

export function initialBoard(variant: Variant): number[] {
  const size = sizeOf(variant);
  const rows = variant === "international" ? 4 : 3;
  return Array.from({ length: size * size }, (_, square) => {
    if (!isDark(square, size)) return EMPTY;
    const row = Math.floor(square / size);
    if (row < rows) return 2; // seat 1's men, at the top
    if (row >= size - rows) return 0; // seat 0's men, at the bottom
    return EMPTY;
  });
}

export const countPieces = (board: readonly number[], seat: number) =>
  board.reduce((n, v) => (v !== EMPTY && seatOf(v) === seat ? n + 1 : n), 0);

export const engine: TurnEngine<State, Action, Config | undefined> = {
  initialState(config) {
    const { variant } = configFrom(config);
    const board = initialBoard(variant);
    return {
      variant,
      size: sizeOf(variant),
      board,
      turn: 0,
      moves: 0,
      last: null,
      quiet: 0,
      seen: [positionKey(board, 0)],
      over: false,
      winner: null,
    };
  },

  legalActions(state, seat) {
    if (state.over || seat !== state.turn) return [];
    return movesFor(state, seat).map((m) => ({ path: m.path }));
  },

  applyAction(state, seat, action) {
    if (state.over || seat !== state.turn || !Array.isArray(action.path)) return state;
    const move = movesFor(state, seat).find((m) => samePath(m.path, action.path));
    if (!move) return state;
    const { size } = state;
    const board = state.board.slice();
    const from = move.path[0] ?? 0;
    const to = move.path.at(-1) ?? from;
    let piece = board[from] ?? EMPTY;
    const wasMan = !isKing(piece);
    board[from] = EMPTY;
    for (const square of move.captures) board[square] = EMPTY;
    // Crowned on the far row (International: only where the move ends; Russian
    // crowns mid-capture too, which the path already went through).
    const crossed = state.variant === "russian" ? move.path.slice(1) : [to];
    if (crossed.some((sq) => Math.floor(sq / size) === farRow(seat, size))) piece |= 1;
    board[to] = piece;

    const other = 1 - seat;
    const irreversible = move.captures.length > 0 || wasMan;
    const quiet = irreversible ? 0 : state.quiet + 1;
    const key = positionKey(board, other);
    const seen = irreversible ? [key] : [...state.seen, key];
    const base = { ...state, board, turn: other, moves: state.moves + 1, last: move, quiet, seen };
    if (movesFor({ board, size, variant: state.variant }, other).length === 0) {
      return { ...base, over: true, winner: seat };
    }
    const repeated = seen.filter((k) => k === key).length >= 3;
    if (repeated || quiet >= QUIET_LIMIT) return { ...base, over: true, winner: null };
    return base;
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
