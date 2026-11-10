// The server's verdict on a rated turn game other than chess (Phase 11:
// Checkers, Go), as chess-rated.ts decides chess: it replays the actions
// each player recorded (private.rated_moves, in the order and at the times
// the server received them) with the game's own engine, in the room's
// options, runs both clocks from those times, and works out the result
// itself. Side actions (such as resigning) take no time. A move recorded
// out of turn waits for its turn, as in chess; one the engine refuses makes
// the game one to review.
import { canonicalJson, type GameResult, type TurnEngine } from "./engines.ts";
import {
  COUNTDOWN_MS,
  FLAG_GRACE_MS,
  type RatedGame,
  type Recorded,
  type Verdict,
} from "./chess-rated.ts";

const twoSeats = (outcome: readonly number[] | undefined): [number, number] => [
  outcome?.[0] ?? 0.5,
  outcome?.[1] ?? 0.5,
];

/** Works out the game from its recorded actions, as of `now`. */
export function decideTurn(
  engine: TurnEngine,
  config: unknown,
  seed: string,
  game: RatedGame,
  recorded: readonly Recorded[],
  now: Date,
): Verdict {
  let state = engine.initialState(config, 2, seed);
  const baseMs = game.clock.base * 1000;
  const incrementMs = game.clock.increment * 1000;
  const clocks = [baseMs, baseMs];
  let turnStarted = game.startedAt.getTime() + COUNTDOWN_MS;
  let refused = 0;
  /** Moves recorded before their turn, in order. */
  const waiting: { seat: number; action: unknown }[] = [];
  const mover = () => engine.currentSeats(state)[0] ?? 0;

  const finish = (result: GameResult, reason: string, at: number): Verdict => ({
    over: true,
    outcome: twoSeats(result.outcome),
    reason,
    endedAt: new Date(at),
    pgn: null,
    // A move still waiting never got its turn: the record is incomplete.
    refused: refused + waiting.length,
  });
  /** The side to move ran out of time at `at`. */
  const flagged = (at: number): Verdict => {
    const seat = mover();
    const result = engine.timeoutResult?.(state, seat) ?? {
      completed: true,
      outcome: seat === 0 ? [0, 1] : [1, 0],
    };
    return finish(result, "timeout", at);
  };
  /** Plays `seat`'s move at `time` (ms); false if the engine refuses it. */
  const play = (seat: number, action: unknown, time: number): boolean => {
    const next = engine.applyAction(state, seat, action);
    if (next === state) return false;
    state = next;
    const spent = Math.max(0, time - turnStarted);
    clocks[seat] = Math.max(0, (clocks[seat] ?? 0) - spent) + incrementMs;
    turnStarted = Math.max(time, turnStarted);
    return true;
  };
  const flagFallsAt = () => turnStarted + (clocks[mover()] ?? 0) + FLAG_GRACE_MS;
  const isSide = (seat: number, action: unknown) =>
    (engine.sideActions?.(state, seat) ?? []).some(
      (a) => canonicalJson(a) === canonicalJson(action),
    );

  for (const { seat, action, at } of recorded) {
    const time = at.getTime();
    if (time > flagFallsAt()) return flagged(flagFallsAt() - FLAG_GRACE_MS);
    if ((seat !== 0 && seat !== 1) || typeof action !== "object" || action === null) {
      refused++;
      continue;
    }
    if (isSide(seat, action)) {
      state = engine.applyAction(state, seat, action);
      const end = engine.result(state);
      if (end) return finish(end, "side", time);
      continue;
    }
    if (seat !== mover()) {
      waiting.push({ seat, action });
      continue;
    }
    // The move, then any waiting move whose turn it now is.
    let next: { seat: number; action: unknown } | undefined = { seat, action };
    while (next) {
      if (!play(next.seat, next.action, time)) refused++;
      const end = engine.result(state);
      if (end) return finish(end, "end", time);
      const i = waiting.findIndex((w) => w.seat === mover());
      next = i < 0 ? undefined : waiting.splice(i, 1)[0];
    }
  }
  if (now.getTime() > flagFallsAt()) {
    return flagged(flagFallsAt() - FLAG_GRACE_MS);
  }
  return { over: false, flagAt: new Date(flagFallsAt()) };
}
