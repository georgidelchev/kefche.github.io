// Room matches on the server (Phase 7 step 5, SPEC §12.5). The room's row
// (start_room) holds the seed, the settings and who sits where, so nothing
// here takes the player's word for them.
//
// - Online turn games: only the host's browser holds the moves, so each
//   account reports the result it saw, and the database counts the match
//   when the reports agree (private.decide_room_match).
// - Races: each player's moves are replayed on the room's seed with the
//   room's options, and the time is the server's, from the race's start.
import * as z from "zod";

import {
  RACE_LOG_LIMITS,
  replayRace,
  unpackActions,
  type GameOption,
  type ServerGame,
  type TimerPreset,
} from "./engines.ts";
import { CLOCK_SLACK, MAX_ACTIONS, TIME_GRACE_MS } from "./solo-play.ts";

/** A race counts down this long after start_room (RaceMatch.tsx's COUNTDOWN_MS). */
export const RACE_COUNTDOWN_MS = 3000;
/** A race without a countdown preset lasts this long (OnlineRoom.tsx). */
const DEFAULT_RACE_MS = 600_000;

const room = { roomId: z.uuid(), seed: z.string().min(1).max(64) };

/** An online turn game's result, as one of its players saw it. */
export const roomResultSchema = z.object({
  ...room,
  result: z.object({
    completed: z.boolean(),
    outcome: z
      .array(z.union([z.literal(0), z.literal(0.5), z.literal(1)]))
      .max(30)
      .optional(),
  }),
});

/** A racer's moves, packed (the log the host replays too). */
export const raceLogSchema = z.object({
  ...room,
  log: z.object({
    dict: z.array(z.unknown()).max(RACE_LOG_LIMITS.dict),
    runs: z.string().max(RACE_LOG_LIMITS.runs),
  }),
});

/** The room's settings, as far as the server reads them (lobby/room-settings.ts). */
export const roomSettingsSchema = z.object({
  timer: z.number().int().nonnegative().catch(0),
  options: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).catch({}),
  startedAt: z.number(),
});

/**
 * The room's timer: the one it names if rooms may use it, or the first they
 * may (page-props.ts onlineTimers, room-match.ts onlineTimer).
 */
export function roomTimer(game: ServerGame, index: number): TimerPreset | null {
  const allowed = game.timers.flatMap((preset, i) =>
    game.awayPlayers === "clock" && preset.kind !== "clock" ? [] : [i],
  );
  const first = game.onlineTimer;
  const order =
    first !== null && allowed.includes(first)
      ? [first, ...allowed.filter((i) => i !== first)]
      : allowed;
  const chosen = order.includes(index) ? index : order[0];
  return chosen === undefined ? null : (game.timers[chosen] ?? null);
}

/** A race's time limit: its countdown preset. */
export const raceLimitMs = (timer: TimerPreset | null): number =>
  timer?.kind === "countdown" ? timer.seconds * 1000 : DEFAULT_RACE_MS;

/** The engine config: each option's chosen value, or its default (race-standings.ts raceConfig). */
export function raceConfig(
  options: readonly GameOption[],
  values: Record<string, unknown>,
): Record<string, unknown> | null {
  if (options.length === 0) return null;
  return Object.fromEntries(
    options.map((option) => {
      const chosen = values[option.key];
      return [
        option.key,
        option.values.some((v) => v.value === chosen) ? chosen : option.values[0]?.value,
      ];
    }),
  );
}

export interface RaceVerdict {
  status: "counted" | "review";
  /** "completed", "over" (out of moves), "time-up", or why it was set aside. */
  reason: string;
  completed: boolean;
  score: number | null;
  /** From the race's start to this report, by the server's clock, within the limit. */
  timeMs: number;
  durationMs: number;
  config: Record<string, unknown> | null;
  timer: TimerPreset | null;
}

export interface Race {
  seed: string;
  config: Record<string, unknown> | null;
  timer: TimerPreset | null;
  /** When the race began (start_room's time plus the countdown). */
  startsAt: Date;
  now: Date;
}

export function judgeRace(
  game: Extract<ServerGame, { kind: "race" }>,
  race: Race,
  log: z.infer<typeof raceLogSchema>["log"],
): RaceVerdict {
  const limit = raceLimitMs(race.timer);
  const elapsed = race.now.getTime() - race.startsAt.getTime();
  const timeMs = Math.round(Math.min(Math.max(elapsed, 0), limit));
  const verdict = (
    status: "counted" | "review",
    reason: string,
    extra: Partial<RaceVerdict> = {},
  ) => ({
    status,
    reason,
    completed: false,
    score: null,
    timeMs,
    durationMs: timeMs,
    config: race.config,
    timer: race.timer,
    ...extra,
  });

  const actions = unpackActions(log, MAX_ACTIONS);
  if (!actions) return verdict("review", "bad-log");
  let replay: ReturnType<typeof replayRace>;
  try {
    replay = replayRace(game.engine, race.config ?? undefined, race.seed, actions);
  } catch {
    return verdict("review", "bad-log");
  }
  // A race doesn't offer hints: a log with one didn't come from the game.
  if (replay.assisted) return verdict("review", "bad-log");
  // A game still going is handed in only when the time is up.
  if (!replay.result && elapsed + TIME_GRACE_MS < limit) return verdict("review", "not-finished");

  // The game's own clock (Snake's ticks) can't have run longer than the race
  // so far, and the moves can't have come faster than a person makes them.
  if (replay.minMs * CLOCK_SLACK > Math.min(elapsed, limit) + TIME_GRACE_MS) {
    return verdict("review", "too-fast");
  }
  const seconds = Math.max(1, timeMs / 1000);
  if (game.maxActionsPerSecond !== null && replay.choices / seconds > game.maxActionsPerSecond) {
    return verdict("review", "too-fast");
  }

  const completed = replay.result?.completed ?? false;
  return verdict("counted", completed ? "completed" : replay.result ? "over" : "time-up", {
    completed,
    score: replay.score ?? replay.result?.score ?? null,
  });
}
