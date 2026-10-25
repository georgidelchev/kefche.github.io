// The server's verdict on a turn game played on one device (Phase 7 step 5,
// SPEC §12.5): against bots, or people passing the device. It replays the
// moves on the seed the server issued (private.plays) with the game's own
// engine: every move must be one the engine offered that seat then, and the
// end must be the result the player claims. A bot's moves can't be told from
// a person's, so games against bots stay off leaderboards (Phase 7 Q1).
import * as z from "zod";

import {
  canonicalJson,
  replayTurn,
  type GameResult,
  type ServerGame,
  type TimerPreset,
} from "./engines.ts";
import { TIME_GRACE_MS, type IssuedPlay } from "./solo-play.ts";

const MAX_MOVES = 5000;
const gameId = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(40);

const seatSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("human") }),
  z.object({
    kind: z.literal("bot"),
    difficulty: z.enum(["easy", "medium", "hard"]),
    level: z.number().int().optional(),
  }),
]);

/** A finished turn game as the player sends it (apps/web/src/features/games/plays.ts). */
export const turnRecordSchema = z.object({
  playId: z.uuid(),
  gameId,
  version: z.number().int().positive(),
  mode: z.enum(["solo-bots", "hotseat"]),
  config: z.unknown(),
  timer: z.unknown(),
  seats: z.array(seatSchema).min(1).max(30),
  moves: z
    .array(z.object({ seat: z.number().int().min(0).max(29), action: z.unknown() }))
    .max(MAX_MOVES),
  timedOut: z.number().int().min(0).max(29).optional(),
  result: z.object({
    outcome: z.array(z.number()).max(30).optional(),
    completed: z.boolean(),
    score: z.number().optional(),
    timeMs: z.number().nonnegative().optional(),
  }),
  durationMs: z.number().int().nonnegative(),
});
export type TurnRecord = z.infer<typeof turnRecordSchema>;

export interface TurnVerdict {
  status: "counted" | "review";
  /** How the game ended ("completed", "timeout"), or why it was set aside. */
  reason: string;
  /** Per seat, from the replay; null when set aside before the end was known. */
  outcome: number[] | null;
  durationMs: number;
  /** The seat the account played (against bots); null on one device. */
  player: number | null;
  config: Record<string, unknown> | null;
  timer: TimerPreset | null;
}

/** The least real time a seat takes to lose on time with this preset (null: it can't). */
function timeoutMs(timer: TimerPreset): number | null {
  if (timer.kind === "clock") return timer.base * 1000;
  if (timer.kind === "per-move" && timer.onExpiry === "loss") return timer.seconds * 1000;
  if (timer.kind === "countdown") return timer.seconds * 1000;
  return null;
}

export function judgeTurn(
  game: Extract<ServerGame, { kind: "turn" }>,
  play: IssuedPlay,
  record: TurnRecord,
): TurnVerdict {
  const elapsed = play.now.getTime() - play.startedAt.getTime();
  const humans = record.seats.flatMap((s, i) => (s.kind === "human" ? [i] : []));
  const player = record.mode === "solo-bots" ? (humans[0] ?? null) : null;
  const timer = game.timers.find((t) => canonicalJson(t) === canonicalJson(record.timer)) ?? null;
  const config =
    typeof record.config === "object" && record.config !== null && !Array.isArray(record.config)
      ? (record.config as Record<string, unknown>)
      : null;
  const verdict = (
    status: "counted" | "review",
    reason: string,
    extra: Partial<TurnVerdict> = {},
  ) => ({
    status,
    reason,
    outcome: null,
    durationMs: Math.min(record.durationMs, Math.max(0, elapsed)),
    player,
    config,
    timer,
    ...extra,
  });

  // The setup must be one the game offers: its mode, its seats and a timer of its own.
  const seats = record.seats.length;
  const setupFits =
    game.modes.includes(record.mode) &&
    seats >= game.players.min &&
    seats <= game.players.max &&
    timer !== null &&
    (config !== null || record.config === null || record.config === undefined) &&
    (record.mode === "solo-bots" ? humans.length === 1 : humans.length >= 2);
  if (!setupFits) return verdict("review", "bad-config");

  let replay: ReturnType<typeof replayTurn>;
  try {
    replay = replayTurn(game.engine, config ?? undefined, seats, play.seed, record.moves);
  } catch {
    return verdict("review", "bad-log");
  }
  if (replay.refused > 0) return verdict("review", "bad-log");

  // A loss on time: the game wasn't over yet, it was that seat's turn, there
  // was a timer, and the seat had at least its starting time to use up.
  let result: GameResult | null = replay.result;
  if (record.timedOut !== undefined) {
    const least = timeoutMs(timer);
    const onTurn = game.engine.currentSeats(replay.state).includes(record.timedOut);
    if (result !== null || !onTurn || least === null) return verdict("review", "bad-log");
    if (record.durationMs + TIME_GRACE_MS < least) return verdict("review", "time-mismatch");
    result = game.engine.timeoutResult?.(replay.state, record.timedOut) ?? {
      completed: true,
      outcome: record.seats.map((_, i) => (i === record.timedOut ? 0 : 1)),
    };
  }
  if (!result) return verdict("review", "not-finished");

  const { timeMs: _time, ...claimed } = record.result;
  const { timeMs: _replayTime, ...replayed } = result;
  if (canonicalJson(claimed) !== canonicalJson(replayed)) {
    return verdict("review", "replay-mismatch");
  }
  if (record.durationMs > elapsed + TIME_GRACE_MS) return verdict("review", "time-mismatch");

  return verdict("counted", record.timedOut === undefined ? "completed" : "timeout", {
    outcome: result.outcome ?? null,
  });
}
