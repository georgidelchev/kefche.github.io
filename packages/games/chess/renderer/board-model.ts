// What the board shows, worked out from the engine's state: square names
// for either orientation, the material each side is ahead by, where a piece
// could go as a premove, and the king in check.
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

import { boardOf, type State } from "../engine";

import type { PieceCode } from "./pieces";

export const FILES = "abcdefgh";

/** The square at a row and column of the board as drawn (row 0 at the top). */
export function squareAt(row: number, col: number, flipped: boolean): Square {
  const file = flipped ? 7 - col : col;
  const rank = flipped ? row + 1 : 8 - row;
  return `${FILES[file] ?? "a"}${String(rank)}` as Square;
}

export const codeOf = (color: Color, type: PieceSymbol) =>
  `${color}${type.toUpperCase()}` as PieceCode;

export const colorOf = (seat: number): Color => (seat === 0 ? "w" : "b");

const VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const ORDER: PieceSymbol[] = ["q", "r", "b", "n", "p"];

export interface Material {
  /** Per seat: the other side's pieces it has more of (what it has taken, net). */
  taken: [PieceSymbol[], PieceSymbol[]];
  /** Per seat: how many points it is ahead by, or 0. */
  lead: [number, number];
}

export function materialOf(chess: Chess): Material {
  const count = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  };
  for (const row of chess.board())
    for (const piece of row) if (piece) count[piece.color][piece.type]++;
  const taken: [PieceSymbol[], PieceSymbol[]] = [[], []];
  let score = 0;
  for (const type of ORDER) {
    const diff = count.w[type] - count.b[type];
    score += diff * VALUES[type];
    const side = diff > 0 ? taken[0] : taken[1];
    for (let i = 0; i < Math.abs(diff); i++) side.push(type);
  }
  return { taken, lead: [Math.max(0, score), Math.max(0, -score)] };
}

/**
 * Where the piece on `from` could go as a premove: its moves as if it were
 * `seat`'s turn now, plus a pawn's diagonals, which become captures if the
 * other side moves a piece there.
 */
export function premoveTargets(state: State, seat: number, from: Square): Square[] {
  const fields = state.fen.split(" ");
  fields[1] = colorOf(seat);
  fields[3] = "-";
  let chess: Chess;
  try {
    chess = new Chess(fields.join(" "), { skipValidation: true });
  } catch {
    return [];
  }
  const piece = chess.get(from);
  if (piece?.color !== colorOf(seat)) return [];
  const targets = new Set(chess.moves({ square: from, verbose: true }).map((m) => m.to));
  if (piece.type === "p") {
    const file = FILES.indexOf(from[0] ?? "");
    const rank = Number(from[1]) + (piece.color === "w" ? 1 : -1);
    for (const f of [file - 1, file + 1]) {
      if (f >= 0 && f < 8 && rank >= 1 && rank <= 8) {
        targets.add(`${FILES[f] ?? "a"}${String(rank)}` as Square);
      }
    }
  }
  return [...targets].filter((to) => chess.get(to)?.color !== piece.color);
}

/** The square of the king to move when it's in check. */
export function checkedKing(chess: Chess): Square | null {
  if (!chess.inCheck()) return null;
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece?.type === "k" && piece.color === chess.turn()) return piece.square;
    }
  }
  return null;
}

/** The squares of the last move, for the highlight. */
export function lastMoveOf(state: State): { from: Square; to: Square } | null {
  const uci = state.moves.at(-1);
  if (!uci) return null;
  return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square };
}

/** Moves so far in SAN, as the move list shows them. */
export const historyOf = (state: State): string[] => boardOf(state).history();

/** True when a pawn on `from` lands on the last rank at `to`. */
export function isPromotion(chess: Chess, from: Square, to: Square): boolean {
  const piece = chess.get(from);
  return piece?.type === "p" && (to[1] === "8" || to[1] === "1");
}
