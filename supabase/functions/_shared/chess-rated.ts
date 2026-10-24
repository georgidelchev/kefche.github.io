// The server's verdict on a rated chess game (SPEC §12.5): it replays the
// actions each player recorded (private.rated_moves, in the order and at the
// times the server received them) with chess.js, runs both clocks from those
// times, and works out the result itself. The rules are the browser engine's
// (packages/games/chess/engine): seat 0 is white; resign, draw offers and
// answers are side actions; rated games have no takebacks; losing on time
// against a side that can't mate is a draw.
//
// Each player's actions arrive in the order they took them, but the two
// players' records can cross on the way: a premove sent the instant the
// opponent's move arrived may reach the server first. A move recorded out of
// turn therefore waits for its turn and is played then, taking no time.
import { Chess } from "chess.js";
import * as z from "zod";

export interface RatedGame {
  /** Seconds. */
  clock: { base: number; increment: number };
  startedAt: Date;
  /** Display names per seat, for the PGN. */
  names: readonly [string, string];
  pool: string;
}

export interface Recorded {
  seat: number;
  action: unknown;
  at: Date;
}

export type Verdict =
  | {
      over: false;
      /** When to ask again: the side to move's flag falls (with grace). */ flagAt: Date;
    }
  | {
      over: true;
      /** Points per seat: 1, 0.5 or 0. */
      outcome: [number, number];
      reason: string;
      endedAt: Date;
      pgn: string;
      /** Recorded moves that weren't legal when they arrived, and junk: a game with any is reviewed. */
      refused: number;
    };

/**
 * Time a flag may run over before it falls: the server's times include each
 * player's network delay and the time the board took to load.
 */
export const FLAG_GRACE_MS = 2000;

/**
 * The browsers count down this long from the match's start before white's
 * clock runs (apps/web/src/features/lobby/OnlineMatch.tsx, RATED_COUNTDOWN_MS).
 */
export const COUNTDOWN_MS = 3000;

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("move"), uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/) }),
  z.object({ type: z.literal("resign") }),
  z.object({ type: z.literal("offer-draw") }),
  z.object({ type: z.literal("accept-draw") }),
  z.object({ type: z.literal("decline-draw") }),
]);

const other = (seat: number) => 1 - seat;

/** Whether `seat` has anything to mate with (more than a lone king, or king and one minor piece). */
function canMate(chess: Chess, seat: number): boolean {
  const color = seat === 0 ? "w" : "b";
  const pieces = chess
    .board()
    .flat()
    .filter((p) => p !== null && p.color === color && p.type !== "k");
  return !(pieces.length === 0 || (pieces.length === 1 && /[nb]/.test(pieces[0]?.type ?? "")));
}

function ending(chess: Chess): { winner: number | null; reason: string } | null {
  if (chess.isCheckmate()) return { winner: chess.turn() === "w" ? 1 : 0, reason: "checkmate" };
  if (chess.isStalemate()) return { winner: null, reason: "stalemate" };
  if (chess.isInsufficientMaterial()) return { winner: null, reason: "insufficient" };
  if (chess.isThreefoldRepetition()) return { winner: null, reason: "threefold" };
  if (chess.isDrawByFiftyMoves()) return { winner: null, reason: "fifty-moves" };
  return null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const pgnDate = (d: Date) =>
  `${String(d.getUTCFullYear())}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`;

/** Works out the game from its recorded actions, as of `now`. */
export function decide(game: RatedGame, recorded: readonly Recorded[], now: Date): Verdict {
  const chess = new Chess();
  const baseMs = game.clock.base * 1000;
  const incrementMs = game.clock.increment * 1000;
  const clocks = [baseMs, baseMs];
  let turnStarted = game.startedAt.getTime() + COUNTDOWN_MS;
  let drawOffer: number | null = null;
  let refused = 0;
  /** Moves recorded before their turn, in order. */
  const waiting: { seat: number; uci: string }[] = [];

  const finish = (winner: number | null, reason: string, at: number): Verdict => {
    const outcome: [number, number] = winner === null ? [0.5, 0.5] : winner === 0 ? [1, 0] : [0, 1];
    chess.setHeader("Event", `kefche rated ${game.pool}`);
    chess.setHeader("Site", "kefche");
    chess.setHeader("Date", pgnDate(game.startedAt));
    chess.setHeader("White", game.names[0]);
    chess.setHeader("Black", game.names[1]);
    chess.setHeader("TimeControl", `${String(game.clock.base)}+${String(game.clock.increment)}`);
    // The PGN standard's terms; the reason itself is stored with the match.
    chess.setHeader("Termination", reason === "timeout" ? "time forfeit" : "normal");
    chess.setHeader("Result", winner === null ? "1/2-1/2" : winner === 0 ? "1-0" : "0-1");
    // A move still waiting never got its turn: the record is incomplete.
    return {
      over: true,
      outcome,
      reason,
      endedAt: new Date(at),
      pgn: chess.pgn(),
      refused: refused + waiting.length,
    };
  };
  /** The side to move ran out of time at `at`: a loss, or a draw if the other side can't mate. */
  const flagged = (at: number): Verdict => {
    const mover = chess.turn() === "w" ? 0 : 1;
    return finish(canMate(chess, other(mover)) ? other(mover) : null, "timeout", at);
  };
  /** Plays `seat`'s move at `time` (ms); false if it isn't legal. */
  const play = (seat: number, uci: string, time: number): boolean => {
    try {
      chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        ...(uci.length > 4 ? { promotion: uci.slice(4) } : {}),
      });
    } catch {
      return false;
    }
    // The mover's clock, from the server's times, plus the increment.
    // (A move recorded before the countdown ended takes no time.)
    const spent = Math.max(0, time - turnStarted);
    clocks[seat] = Math.max(0, (clocks[seat] ?? 0) - spent) + incrementMs;
    turnStarted = Math.max(time, turnStarted);
    // Moving answers the other side's draw offer with a no.
    if (drawOffer === other(seat)) drawOffer = null;
    return true;
  };
  /** When the side to move's flag falls, grace included. */
  const flagFallsAt = () =>
    turnStarted + (clocks[chess.turn() === "w" ? 0 : 1] ?? 0) + FLAG_GRACE_MS;

  for (const { seat, action, at } of recorded) {
    const time = at.getTime();
    if (time > flagFallsAt()) return flagged(flagFallsAt() - FLAG_GRACE_MS);
    const parsed = actionSchema.safeParse(action);
    if (!parsed.success || (seat !== 0 && seat !== 1)) {
      refused++;
      continue;
    }
    const a = parsed.data;
    switch (a.type) {
      case "resign":
        return finish(other(seat), "resign", time);
      // An offer or answer that crossed a move is ignored, as the host does.
      case "offer-draw":
        drawOffer ??= seat;
        break;
      case "accept-draw":
        if (drawOffer === other(seat)) return finish(null, "agreement", time);
        break;
      case "decline-draw":
        if (drawOffer === other(seat)) drawOffer = null;
        break;
      case "move": {
        if (seat !== (chess.turn() === "w" ? 0 : 1)) {
          waiting.push({ seat, uci: a.uci });
          break;
        }
        // The move, then any waiting move whose turn it now is.
        let next: { seat: number; uci: string } | undefined = { seat, uci: a.uci };
        while (next) {
          if (!play(next.seat, next.uci, time)) refused++;
          const end = ending(chess);
          if (end) return finish(end.winner, end.reason, time);
          const mover = chess.turn() === "w" ? 0 : 1;
          const i = waiting.findIndex((w) => w.seat === mover);
          next = i < 0 ? undefined : waiting.splice(i, 1)[0];
        }
        break;
      }
    }
  }
  if (now.getTime() > flagFallsAt()) return flagged(flagFallsAt() - FLAG_GRACE_MS);
  return { over: false, flagAt: new Date(flagFallsAt()) };
}
