// Chess rules (SPEC catalog #1) on chess.js: seat 0 plays white and moves
// first. Moves are UCI strings ("e2e4", "e7e8q"). The game ends on checkmate,
// stalemate, insufficient material, threefold repetition, the 50-move rule,
// resignation or an agreed draw; running out of time loses, unless the other
// side has nothing left to mate with (a draw). Draw offers, resignation and
// takebacks are side actions: either player, at any moment, without taking a
// turn. Takebacks are for casual games only (`config.takebacks`).
//
// The state is plain data, so it travels as JSON and replays anywhere,
// including the server's check of rated games: the moves so far, the
// position, and any offer waiting for an answer. A position is rebuilt from
// the moves (threefold repetition needs the whole game), cached per state.
import { Chess, type Move } from "chess.js";

import type { GameResult, TurnEngine } from "@kefche/game-sdk";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export interface Config {
  /** Casual games: a player may ask to take back their last move. */
  takebacks: boolean;
}

export type EndReason =
  | "checkmate"
  | "stalemate"
  | "insufficient"
  | "threefold"
  | "fifty-moves"
  | "resign"
  | "agreement"
  | "timeout";

export interface End {
  reason: EndReason;
  /** The winning seat, or null for a draw. */
  winner: number | null;
}

export interface State {
  config: Config;
  /** Every move so far, in UCI. */
  moves: string[];
  /** The position now. */
  fen: string;
  /** The seat whose draw offer waits for an answer, or null. */
  drawOffer: number | null;
  /** The seat asking to take back its last move, or null. */
  takeback: number | null;
  end: End | null;
}

export type Action =
  | { type: "move"; uci: string }
  | { type: "resign" }
  | { type: "offer-draw" }
  | { type: "accept-draw" }
  | { type: "decline-draw" }
  | { type: "takeback" }
  | { type: "accept-takeback" }
  | { type: "decline-takeback" };

/** White is seat 0, black seat 1. */
export const seatOf = (color: "w" | "b") => (color === "w" ? 0 : 1);
export const turnOf = (state: Pick<State, "fen">) => (state.fen.split(" ")[1] === "b" ? 1 : 0);
const other = (seat: number) => 1 - seat;

export const uciOf = (move: Pick<Move, "from" | "to" | "promotion">) =>
  `${move.from}${move.to}${move.promotion ?? ""}`;

function play(chess: Chess, uci: string): Move | null {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.slice(4, 5);
  try {
    return chess.move(promotion ? { from, to, promotion } : { from, to });
  } catch {
    return null;
  }
}

/** The game so far as a chess.js board; null if a move doesn't replay. */
export function replay(moves: readonly string[]): Chess | null {
  const chess = new Chess();
  for (const uci of moves) if (!play(chess, uci)) return null;
  return chess;
}

// Rebuilding a position replays the whole game, so each state keeps its board.
const boards = new WeakMap<State, Chess>();
export function boardOf(state: State): Chess {
  const known = boards.get(state);
  if (known) return known;
  const chess = replay(state.moves) ?? new Chess(state.fen);
  boards.set(state, chess);
  return chess;
}

/** How the game stands after the last move, or null while it goes on. */
function ending(chess: Chess): End | null {
  if (chess.isCheckmate()) return { reason: "checkmate", winner: other(seatOf(chess.turn())) };
  if (chess.isStalemate()) return { reason: "stalemate", winner: null };
  if (chess.isInsufficientMaterial()) return { reason: "insufficient", winner: null };
  if (chess.isThreefoldRepetition()) return { reason: "threefold", winner: null };
  if (chess.isDrawByFiftyMoves()) return { reason: "fifty-moves", winner: null };
  return null;
}

/**
 * Whether `seat` still has anything to mate with: more than a lone king, or a
 * king and one knight or bishop. Losing on time to such a side is a draw.
 */
export function canMate(state: Pick<State, "fen">, seat: number): boolean {
  const placement = state.fen.split(" ")[0] ?? "";
  const mine = placement.match(seat === 0 ? /[PNBRQ]/g : /[pnbrq]/g) ?? [];
  if (mine.length === 0) return false;
  return !(mine.length === 1 && /[nbNB]/.test(mine[0]));
}

const withBoard = (state: State, chess: Chess): State => {
  boards.set(state, chess);
  return state;
};

/** Takes back plies until it's `seat`'s turn again, with its last move undone. */
function takeBack(state: State, seat: number): State {
  // The requester just moved (one ply), or the other side has replied (two).
  const plies = turnOf(state) === seat ? 2 : 1;
  if (state.moves.length < plies) return state;
  const moves = state.moves.slice(0, -plies);
  const chess = replay(moves);
  if (!chess) return state;
  return withBoard(
    { ...state, moves, fen: chess.fen(), drawOffer: null, takeback: null, end: null },
    chess,
  );
}

/** Whether `seat` has made a move that could be taken back. */
const hasMoved = (state: State, seat: number) => state.moves.length > seat;

export const engine: TurnEngine<State, Action, Config> = {
  initialState(config) {
    return { config, moves: [], fen: START_FEN, drawOffer: null, takeback: null, end: null };
  },

  legalActions(state, seat) {
    if (state.end || seat !== turnOf(state)) return [];
    return boardOf(state)
      .moves({ verbose: true })
      .map((m) => ({ type: "move", uci: uciOf(m) }));
  },

  sideActions(state, seat) {
    if (state.end || (seat !== 0 && seat !== 1)) return [];
    const actions: Action[] = [{ type: "resign" }];
    if (state.drawOffer === other(seat)) {
      actions.push({ type: "accept-draw" }, { type: "decline-draw" });
    } else if (state.drawOffer === null) {
      actions.push({ type: "offer-draw" });
    }
    if (state.config.takebacks) {
      if (state.takeback === other(seat)) {
        actions.push({ type: "accept-takeback" }, { type: "decline-takeback" });
      } else if (state.takeback === null && hasMoved(state, seat)) {
        actions.push({ type: "takeback" });
      }
    }
    return actions;
  },

  applyAction(state, seat, action) {
    if (state.end || (seat !== 0 && seat !== 1)) return state;
    switch (action.type) {
      case "move": {
        if (seat !== turnOf(state)) return state;
        // The new state takes this one's board over, so a move costs one
        // move, not a replay; the old state rebuilds its own if it's asked.
        const chess = boardOf(state);
        const move = play(chess, action.uci);
        if (!move) return state;
        boards.delete(state);
        return withBoard(
          {
            ...state,
            moves: [...state.moves, uciOf(move)],
            fen: chess.fen(),
            // Moving answers the other side's offer with a no; a takeback request lapses.
            drawOffer: state.drawOffer === seat ? seat : null,
            takeback: null,
            end: ending(chess),
          },
          chess,
        );
      }
      case "resign":
        return { ...state, end: { reason: "resign", winner: other(seat) } };
      case "offer-draw":
        if (state.drawOffer !== null) return state;
        return { ...state, drawOffer: seat };
      case "accept-draw":
        if (state.drawOffer !== other(seat)) return state;
        return { ...state, drawOffer: null, end: { reason: "agreement", winner: null } };
      case "decline-draw":
        if (state.drawOffer !== other(seat)) return state;
        return { ...state, drawOffer: null };
      case "takeback":
        if (!state.config.takebacks || state.takeback !== null || !hasMoved(state, seat)) {
          return state;
        }
        return { ...state, takeback: seat };
      case "accept-takeback":
        if (state.takeback !== other(seat)) return state;
        return takeBack(state, other(seat));
      case "decline-takeback":
        if (state.takeback !== other(seat)) return state;
        return { ...state, takeback: null };
    }
  },

  currentSeats(state) {
    return state.end ? [] : [turnOf(state)];
  },

  result(state) {
    if (!state.end) return null;
    const { winner } = state.end;
    return {
      completed: true,
      outcome: winner === null ? [0.5, 0.5] : [winner === 0 ? 1 : 0, winner === 1 ? 1 : 0],
    };
  },

  timeoutResult(state, seat): GameResult {
    // A flag fall against a side that can't mate is a draw.
    if (!canMate(state, other(seat))) return { completed: true, outcome: [0.5, 0.5] };
    return { completed: true, outcome: [seat === 0 ? 0 : 1, seat === 1 ? 0 : 1] };
  },
};

/** The game as PGN, with the result once it's over. */
export function pgnOf(
  state: State,
  headers: Readonly<Record<string, string>> = {},
  result: GameResult | null = engine.result(state),
): string {
  const chess = replay(state.moves) ?? new Chess();
  for (const [key, value] of Object.entries(headers)) chess.setHeader(key, value);
  const outcome = result?.outcome;
  chess.setHeader(
    "Result",
    !outcome ? "*" : outcome[0] === 1 ? "1-0" : outcome[1] === 1 ? "0-1" : "1/2-1/2",
  );
  return chess.pgn();
}
