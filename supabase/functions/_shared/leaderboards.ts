// Leaderboards for a game played alone (Phase 7 step 10, SPEC §12.4): the
// boards of the game's manifest that a counted result goes on, with its
// value. A board may be for one setting (Sudoku's difficulty: `when`); a
// time board takes only a finished game's time. Assisted games (hints) go on
// none, as they set no best. The database keeps each player's best of all
// time and of the week (leaderboard_submit).
import type { SupabaseClient } from "@supabase/supabase-js";
import * as z from "zod";

import type { LeaderboardDef } from "./engines.ts";
import { log } from "./http.ts";

export interface BoardEntry {
  /** "<game id>.<board id>" */
  board: string;
  gameId: string;
  lowerIsBetter: boolean;
  value: number;
}

export interface CountedSolo {
  config: unknown;
  score: number | null;
  timeMs: number | null;
  completed: boolean;
  assisted: boolean;
}

/** The boards a counted game goes on, and its value on each. */
export function boardEntries(
  gameId: string,
  boards: readonly LeaderboardDef[],
  game: CountedSolo,
): BoardEntry[] {
  if (game.assisted) return [];
  const config = (
    typeof game.config === "object" && game.config !== null ? game.config : {}
  ) as Record<string, unknown>;
  const entries: BoardEntry[] = [];
  for (const board of boards) {
    const fits = Object.entries(board.when ?? {}).every(([key, value]) => config[key] === value);
    if (!fits) continue;
    const value = board.metric === "score" ? game.score : game.completed ? game.timeMs : null;
    if (value === null || !Number.isFinite(value)) continue;
    entries.push({
      board: `${gameId}.${board.id}`,
      gameId,
      lowerIsBetter: board.order === "asc",
      value,
    });
  }
  return entries;
}

export const placeSchema = z.object({
  board: z.string(),
  all: z.number().int().nullable().optional(),
  week: z.number().int().nullable().optional(),
  /** A daily challenge's board: the place on its day. */
  day: z.number().int().nullable().optional(),
});
/** A player's places on a board after a game (null: not shown on leaderboards). */
export type Place = z.infer<typeof placeSchema>;

/** Puts the entries on their boards, and returns the player's places (none if it fails). */
export async function submitToBoards(
  admin: SupabaseClient,
  userId: string,
  matchId: string,
  entries: readonly BoardEntry[],
): Promise<Place[]> {
  if (entries.length === 0) return [];
  const { data, error } = await admin.rpc("leaderboard_submit", {
    p_user: userId,
    p_match: matchId,
    p_entries: entries,
  });
  const places = error ? null : z.array(placeSchema).safeParse(data);
  if (!places?.success) {
    log("error", "leaderboard_failed", { match: matchId, error: error?.message ?? "shape" });
    return [];
  }
  return places.data;
}

/**
 * Whether a game was played with the daily challenge's settings: every
 * setting the day fixes, as the day fixed it (2048 fixes none).
 */
export function playedAsDaily(daily: Readonly<Record<string, unknown>>, config: unknown): boolean {
  const played = (typeof config === "object" && config !== null ? config : {}) as Record<
    string,
    unknown
  >;
  return Object.entries(daily).every(([key, value]) => played[key] === value);
}

const dailyAnswerSchema = z.object({ place: z.number().int().nullable(), xp: z.number().int() });

/**
 * Puts a counted daily game on its day's board ("daily.<game>"; none for a
 * game with nothing to rank, like an unfinished Sudoku) and gives the day's
 * XP once. Returns the player's place on the day's board, or null.
 */
export async function submitDaily(
  admin: SupabaseClient,
  userId: string,
  matchId: string,
  day: string,
  entry: BoardEntry | null,
): Promise<Place | null> {
  const { data, error } = await admin.rpc("daily_submit", {
    p_user: userId,
    p_match: matchId,
    p_day: day,
    p_entry: entry ?? {},
  });
  const answer = error ? null : dailyAnswerSchema.safeParse(data);
  if (!answer?.success) {
    log("error", "daily_failed", { match: matchId, error: error?.message ?? "shape" });
    return null;
  }
  return entry ? { board: entry.board, day: answer.data.place } : null;
}
