// What the analysis view works from: a finished game read from its PGN, the
// engine's line in notation, and its score from White's side.
import { Chess, type Square } from "chess.js";

import type { EngineScore } from "./engine-protocol";

export interface Ply {
  san: string;
  from: Square;
  to: Square;
  /** The position after this move. */
  fen: string;
}

export interface GameRecord {
  /** The position before the first move. */
  start: string;
  plies: Ply[];
  /** White and Black, as the PGN names them. */
  names: [string, string];
}

/** The game in a PGN, or null if it doesn't read. */
export function readRecord(pgn: string): GameRecord | null {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    return null;
  }
  const history = chess.history({ verbose: true });
  const headers = chess.getHeaders();
  return {
    start: history[0]?.before ?? chess.fen(),
    plies: history.map((move) => ({
      san: move.san,
      from: move.from,
      to: move.to,
      fen: move.after,
    })),
    names: [headers.White ?? "", headers.Black ?? ""],
  };
}

/** A score from White's side: the engine's is the side to move's. */
export function forWhite(score: EngineScore, fen: string): EngineScore {
  const flip = fen.split(" ")[1] === "b" ? -1 : 1;
  return "cp" in score ? { cp: score.cp * flip } : { mate: score.mate * flip };
}

/**
 * White's share of the evaluation bar, 0–100: the expected score from the
 * centipawns (Lichess's winning-chances curve), or all of it for a mate.
 */
export function whiteShare(score: EngineScore): number {
  if ("mate" in score) return score.mate > 0 ? 100 : 0;
  const chances = 2 / (1 + Math.exp(-0.00368208 * score.cp)) - 1;
  return 50 + 50 * chances;
}

/** The engine's line from `fen` in notation, with move numbers ("12… Nf6 13. Nc3"). */
export function lineText(fen: string, pv: readonly string[], plies = 10): string {
  const chess = new Chess(fen);
  const fields = fen.split(" ");
  let number = Number(fields[5] ?? "1");
  let black = fields[1] === "b";
  const parts: string[] = [];
  for (const uci of pv.slice(0, plies)) {
    let san: string;
    try {
      san = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        ...(uci.length > 4 ? { promotion: uci.slice(4) } : {}),
      }).san;
    } catch {
      break;
    }
    if (!black) parts.push(`${String(number)}. ${san}`);
    else parts.push(parts.length === 0 ? `${String(number)}… ${san}` : san);
    if (black) number++;
    black = !black;
  }
  return parts.join(" ");
}
