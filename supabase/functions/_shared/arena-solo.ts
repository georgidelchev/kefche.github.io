// The server's verdict on a life in a real-time game's solo arena (Phase 9
// step 9c). The page records the player's input at each tick (arena-log.ts);
// the life is replayed on the seed the server issued (private.plays), with
// the same arena, bots and skin, for at most ARENA_REPLAY_SECONDS. How it
// ended and its result must be the replay's, and the time believable. A life
// that went on longer counts as it stood then. Solo lives count for the stats
// and XP, not for leaderboards (Phase 9 Q5).
import * as z from "zod";

import {
  ARENA_REPLAY_SECONDS,
  canonicalJson,
  RACE_LOG_LIMITS,
  replayArena,
  type ServerGame,
  unpackActions,
} from "./engines.ts";
import { CLOCK_SLACK, TIME_GRACE_MS, type IssuedPlay } from "./solo-play.ts";

/** A life as the player sends it (apps/web/src/features/games/plays.ts). */
export const arenaLifeRecordSchema = z.object({
  playId: z.uuid(),
  gameId: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(40),
  version: z.number().int().positive(),
  mode: z.literal("arena"),
  /** Knocked out at the log's last tick, or still in play after it. */
  end: z.enum(["out", "playing"]),
  look: z.number().int().min(0).max(255),
  log: z.object({
    dict: z.array(z.unknown()).max(RACE_LOG_LIMITS.dict),
    runs: z.string().max(RACE_LOG_LIMITS.runs),
  }),
  result: z.object({
    score: z.number().optional(),
    timeMs: z.number().nonnegative().optional(),
    completed: z.boolean(),
  }),
  durationMs: z.number().int().nonnegative(),
});
export type ArenaLifeRecord = z.infer<typeof arenaLifeRecordSchema>;

export interface ArenaVerdict {
  status: "counted" | "review";
  /** "out", "left" or "limit" (still in play after the replay's 3 minutes), or why it was set aside. */
  reason: string;
  /** The life's longest length, as replayed. */
  score: number | null;
  durationMs: number;
}

export function judgeArena(
  game: Extract<ServerGame, { kind: "realtime" }>,
  play: IssuedPlay,
  record: ArenaLifeRecord,
): ArenaVerdict {
  const elapsed = play.now.getTime() - play.startedAt.getTime();
  const durationMs = Math.min(record.durationMs, Math.max(0, elapsed));
  const review = (reason: string): ArenaVerdict => ({
    status: "review",
    reason,
    score: null,
    durationMs,
  });

  const maxTicks = ARENA_REPLAY_SECONDS * game.engine.ticksPerSecond;
  const actions = unpackActions(record.log, maxTicks);
  if (!actions || actions.length === 0) return review("bad-log");
  let replay: ReturnType<typeof replayArena>;
  try {
    replay = replayArena(game, play.seed, record.look, actions);
  } catch {
    return review("bad-log");
  }
  // Knocked out where the record says, or still in play at its end; and its result.
  const out = record.end === "out";
  if (replay.ticks !== actions.length || replay.alive === out || !replay.result) {
    return review("replay-mismatch");
  }
  if (canonicalJson(record.result) !== canonicalJson(replay.result)) {
    return review("replay-mismatch");
  }

  // No longer than since the play was issued, and no faster than the arena's clock.
  const clock = ((replay.ticks * 1000) / game.engine.ticksPerSecond) * CLOCK_SLACK;
  if (record.durationMs > elapsed + TIME_GRACE_MS) return review("time-mismatch");
  if (clock > elapsed + TIME_GRACE_MS) return review("too-fast");
  if (clock > record.durationMs + TIME_GRACE_MS) return review("time-mismatch");

  return {
    status: "counted",
    reason: out ? "out" : actions.length === maxTicks ? "limit" : "left",
    score: replay.result.score ?? null,
    durationMs,
  };
}
