// Messages between the analysis view and its Stockfish worker.

/** Evaluate this position (FEN); `id` tells its answers apart from older ones. */
export interface EngineRequest {
  id: number;
  fen: string;
}

/** A score from the side to move's point of view: centipawns, or mate in n (negative: being mated). */
export type EngineScore = { cp: number } | { mate: number };

export type EngineReply =
  | { kind: "ready" }
  /** The best line so far at `depth` (UCI moves). */
  | { kind: "info"; id: number; depth: number; score: EngineScore; pv: string[] }
  /** The search reached its full depth. */
  | { kind: "done"; id: number };
