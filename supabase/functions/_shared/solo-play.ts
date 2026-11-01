// The server's verdict on a single-player game (Phase 7, SPEC §12.5). It
// replays the record on the seed the server issued (private.plays) with the
// game's own engine, and checks that the result matches and the time is
// believable. No client says what it scored: a record that doesn't hold up
// is stored for review and counts for nothing.
import * as z from "zod";

import {
  canonicalJson,
  RACE_LOG_LIMITS,
  replayRace,
  type GameOption,
  type ServerGame,
  unpackActions,
} from "./engines.ts";

/** A finished game as the player sends it (apps/web/src/features/games/plays.ts). */
export const soloRecordSchema = z.object({
  playId: z.uuid(),
  gameId: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(40),
  version: z.number().int().positive(),
  mode: z.literal("solo"),
  config: z.unknown(),
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
export type SoloRecord = z.infer<typeof soloRecordSchema>;

/** The play the server issued: its seed, and when (the server's clock). */
export interface IssuedPlay {
  seed: string;
  startedAt: Date;
  now: Date;
}

export interface SoloVerdict {
  status: "counted" | "review";
  /** How the game ended ("completed", "over"), or why it was set aside. */
  reason: string;
  completed: boolean;
  score: number | null;
  /** The game's own time (Sudoku's solve time), or the play time. */
  timeMs: number;
  durationMs: number;
  /** Played with help (hints): no best score or time, no leaderboard. */
  assisted: boolean;
  /** The engine config the game was played with, as checked. */
  config: Record<string, unknown> | null;
}

/** Grace for network delay and the two clocks. */
export const TIME_GRACE_MS = 5000;
/** A game's own clock (Snake's ticks) may run this much fast. */
export const CLOCK_SLACK = 0.95;
export const MAX_ACTIONS = 200_000;

/** The config if it's one the game offers: every option set to one of its values, nothing else. */
function checkConfig(
  options: readonly GameOption[],
  config: unknown,
): Record<string, unknown> | null | false {
  if (options.length === 0) return config === null || config === undefined ? null : false;
  if (typeof config !== "object" || config === null || Array.isArray(config)) return false;
  const entries = Object.entries(config);
  if (entries.length !== options.length) return false;
  for (const option of options) {
    const value = (config as Record<string, unknown>)[option.key];
    if (!option.values.some((v) => v.value === value)) return false;
  }
  return config as Record<string, unknown>;
}

export function judgeSolo(
  game: Extract<ServerGame, { kind: "race" }>,
  play: IssuedPlay,
  record: SoloRecord,
): SoloVerdict {
  const elapsed = play.now.getTime() - play.startedAt.getTime();
  const claimedTime = record.result.timeMs ?? record.durationMs;
  const verdict = (
    status: "counted" | "review",
    reason: string,
    extra: Partial<SoloVerdict> = {},
  ) => ({
    status,
    reason,
    completed: record.result.completed,
    score: record.result.score ?? null,
    timeMs: Math.round(Math.max(0, Math.min(claimedTime, elapsed))),
    durationMs: Math.min(record.durationMs, Math.max(0, elapsed)),
    assisted: false,
    config: null,
    ...extra,
  });

  const config = checkConfig(game.options, record.config);
  if (config === false) return verdict("review", "bad-config");
  const actions = unpackActions(record.log, MAX_ACTIONS);
  if (!actions) return verdict("review", "bad-log");
  let replay: ReturnType<typeof replayRace>;
  try {
    replay = replayRace(game.engine, config ?? undefined, play.seed, actions);
  } catch {
    return verdict("review", "bad-log", { config });
  }
  const known = { config, assisted: replay.assisted };
  if (!replay.result) return verdict("review", "not-finished", known);

  // The result is the replay's; the claim must match it (the game's time aside).
  const { timeMs: _time, ...claimed } = record.result;
  const { timeMs: _replayTime, ...replayed } = replay.result;
  if (canonicalJson(claimed) !== canonicalJson(replayed)) {
    return verdict("review", "replay-mismatch", known);
  }

  // Times: none longer than since the play was issued, and none shorter than
  // the game's own clock took.
  const clock = replay.minMs * CLOCK_SLACK;
  if (record.durationMs > elapsed + TIME_GRACE_MS || claimedTime > elapsed + TIME_GRACE_MS) {
    return verdict("review", "time-mismatch", known);
  }
  if (clock > elapsed + TIME_GRACE_MS) return verdict("review", "too-fast", known);
  if (clock > record.durationMs + TIME_GRACE_MS) return verdict("review", "time-mismatch", known);
  // Over the shortest time claimed, since that's the time a board shows: a
  // log sent long after its play was issued can't claim a 3-second Sudoku.
  const seconds = Math.max(1, Math.min(elapsed, claimedTime, record.durationMs) / 1000);
  if (game.maxActionsPerSecond !== null && replay.choices / seconds > game.maxActionsPerSecond) {
    return verdict("review", "too-fast", known);
  }

  return verdict("counted", replay.result.completed ? "completed" : "over", {
    ...known,
    completed: replay.result.completed,
    score: replay.score ?? replay.result.score ?? null,
  });
}
