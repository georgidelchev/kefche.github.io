// A table's match on the server (Phase 12, ADR-0047). The table on the arena
// server held the match and reports its moves with its seed (secret until
// then) and ARENA_SECRET; the room's row says who sat where and with what
// settings. The moves are replayed with the game's engine, so a result only
// stands if every move was one the engine offered that seat then.
import * as z from "zod";

import { replayTurn, type GameResult, type ServerGame, type TimerPreset } from "./engines.ts";
import { raceConfig, roomTimer } from "./room-play.ts";

const MAX_MOVES = 20_000;

export const tableReportSchema = z.object({
  table: z.object({
    roomId: z.uuid(),
    match: z.string().min(1).max(64),
    gameId: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .max(40),
    version: z.number().int().positive(),
    seed: z.string().min(16).max(128),
    moves: z
      .array(z.object({ seat: z.number().int().min(0).max(29), action: z.unknown() }))
      .max(MAX_MOVES),
    timedOut: z.number().int().min(0).max(29).nullable(),
  }),
});
export type TableReport = z.infer<typeof tableReportSchema>["table"];

/** The room's match as the database has it (private.table_room). */
export const tableRoomSchema = z.object({
  roomId: z.uuid(),
  gameId: z.string(),
  gameVersion: z.number().int(),
  players: z.number().int().min(1).max(30),
  botSeats: z.array(z.number().int()),
  settings: z.object({
    startedAt: z.number(),
    timer: z.number().int().nonnegative().catch(0),
    options: z.record(z.string(), z.unknown()).catch({}),
    bots: z.record(z.string(), z.string()).catch({}),
  }),
  seats: z.array(z.object({ seat: z.number().int(), userId: z.uuid(), guest: z.boolean() })),
});
export type TableRoom = z.infer<typeof tableRoomSchema>;

export type TableVerdict =
  | {
      ok: true;
      outcome: number[];
      /** "completed" or "timeout". */
      reason: string;
      config: Record<string, unknown> | null;
      timer: TimerPreset | null;
      seats: { seat: number; userId: string | null; bot: string | null }[];
      durationMs: number;
    }
  | { ok: false; reason: string };

export function judgeTable(
  game: Extract<ServerGame, { kind: "turn" }>,
  room: TableRoom,
  report: TableReport,
  now: number,
): TableVerdict {
  if (report.gameId !== room.gameId || report.version !== room.gameVersion) {
    return { ok: false, reason: "wrong-game" };
  }
  const config = raceConfig(game.options, room.settings.options);
  const timer = roomTimer(game, room.settings.timer);
  let replay: ReturnType<typeof replayTurn>;
  try {
    replay = replayTurn(game.engine, config ?? undefined, room.players, report.seed, report.moves);
  } catch {
    return { ok: false, reason: "bad-log" };
  }
  if (replay.refused > 0) return { ok: false, reason: "bad-log" };

  let result: GameResult | null = replay.result;
  if (report.timedOut !== null) {
    const onTurn = game.engine.currentSeats(replay.state).includes(report.timedOut);
    if (result !== null || !onTurn || timer === null || timer.kind === "none") {
      return { ok: false, reason: "bad-log" };
    }
    result = game.engine.timeoutResult?.(replay.state, report.timedOut) ?? {
      completed: true,
      outcome: Array.from({ length: room.players }, (_, i) => (i === report.timedOut ? 0 : 1)),
    };
  }
  const outcome = result?.outcome;
  if (!outcome || outcome.length !== room.players) return { ok: false, reason: "not-finished" };

  return {
    ok: true,
    outcome,
    reason: report.timedOut === null ? "completed" : "timeout",
    config,
    timer,
    seats: Array.from({ length: room.players }, (_, seat) => {
      const bot = room.botSeats.includes(seat);
      return {
        seat,
        userId: bot ? null : (room.seats.find((s) => s.seat === seat)?.userId ?? null),
        bot: bot ? (room.settings.bots[String(seat)] ?? "bot") : null,
      };
    }),
    durationMs: Math.max(0, now - room.settings.startedAt),
  };
}
