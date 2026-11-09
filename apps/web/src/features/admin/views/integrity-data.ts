// The Leaderboards and integrity section's data (Phase 10 step 7): results
// under review (staff_review_matches, staff_decide_match), one match by id
// (staff_match, staff_annul_match), the boards (staff_boards, staff_board,
// staff_remove_board_entry, staff_reset_player_boards) and a player's
// ratings (staff_ratings, staff_reset_rating). Every change is audited.
// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import type { Supabase } from "@/lib/supabase/client";

const text = z.nullable(z.string());
const num = z.nullable(z.number());
const Seat = z.object({
  seat: z.number(),
  userId: text,
  nickname: text,
  outcome: num,
  score: num,
  timeMs: num,
  assisted: z.boolean(),
  ratingBefore: num,
  ratingAfter: num,
});
const Match = z.object({
  id: z.string(),
  gameId: z.string(),
  mode: z.string(),
  rated: z.boolean(),
  pool: text,
  status: z.string(),
  reason: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
  players: z.array(Seat),
});
export type Match = z.infer<typeof Match>;

/** Results under review, newest first; null on failure. */
export async function fetchReview(supabase: Supabase): Promise<Match[] | null> {
  const { data, error } = await supabase.rpc("staff_review_matches");
  if (error) return null;
  const matches = z.array(Match).safeParse(data);
  return matches.success ? matches.data : null;
}

/** One match (null: there's none), or undefined on failure. */
export async function fetchMatch(
  supabase: Supabase,
  id: string,
): Promise<Match | null | undefined> {
  const { data, error } = await supabase.rpc("staff_match", { p_match: id });
  if (error) return undefined;
  const match = z.nullable(Match).safeParse(data);
  return match.success ? match.data : undefined;
}

const done = ({ error }: { error: { message: string } | null }) => (error ? error.message : null);

/** Accepts or rejects a result under review; null when done, else the error code. */
export const decideMatch = async (supabase: Supabase, id: string, accept: boolean) =>
  done(await supabase.rpc("staff_decide_match", { p_match: id, p_accept: accept }));

/** Annuls a counted result; null when done, else the error code. */
export const annulMatch = async (supabase: Supabase, id: string) =>
  done(await supabase.rpc("staff_annul_match", { p_match: id }));

const Board = z.object({ id: z.string(), game_id: text, lower_is_better: z.boolean() });
export type Board = z.infer<typeof Board>;

/** Every board (the game boards; rated boards are ratings); null on failure. */
export async function fetchBoards(supabase: Supabase): Promise<Board[] | null> {
  const { data, error } = await supabase.rpc("staff_boards");
  if (error) return null;
  const boards = z.array(Board).safeParse(data);
  return boards.success ? boards.data : null;
}

const Entry = z.object({
  user_id: z.string(),
  nickname: text,
  value: z.number(),
  match_id: text,
  achieved_at: z.string(),
  shown: z.boolean(),
});
export type Entry = z.infer<typeof Entry>;

/** A board's period, best first (one player's when given); null on failure. */
export async function fetchBoard(
  supabase: Supabase,
  board: string,
  period: string,
  user: string | null,
): Promise<Entry[] | null> {
  const { data, error } = await supabase.rpc("staff_board", {
    p_board: board,
    p_period: period,
    ...(user ? { p_user: user } : {}),
  });
  if (error) return null;
  const entries = z.array(Entry).safeParse(data);
  return entries.success ? entries.data : null;
}

export const removeEntry = async (
  supabase: Supabase,
  board: string,
  period: string,
  user: string,
) =>
  done(
    await supabase.rpc("staff_remove_board_entry", {
      p_board: board,
      p_period: period,
      p_user: user,
    }),
  );

export const resetPlayerBoards = async (supabase: Supabase, user: string, game: string) =>
  done(await supabase.rpc("staff_reset_player_boards", { p_user: user, p_game: game }));

const Rating = z.object({
  game_id: z.string(),
  pool: z.string(),
  rating: z.number(),
  rd: z.number(),
  games: z.number(),
});
export type Rating = z.infer<typeof Rating>;

/** A player's ratings; null on failure. */
export async function fetchRatings(supabase: Supabase, user: string): Promise<Rating[] | null> {
  const { data, error } = await supabase.rpc("staff_ratings", { p_user: user });
  if (error) return null;
  const ratings = z.array(Rating).safeParse(data);
  return ratings.success ? ratings.data : null;
}

export const resetRating = async (supabase: Supabase, user: string, rating: Rating) =>
  done(
    await supabase.rpc("staff_reset_rating", {
      p_user: user,
      p_game: rating.game_id,
      p_pool: rating.pool,
    }),
  );

/** The player a text names: an account id, or an exact nickname; null if none. */
export async function findPlayer(
  supabase: Supabase,
  query: string,
): Promise<{ id: string; nickname: string | null } | null> {
  const { data, error } = await supabase.rpc("staff_find_players", { p_query: query });
  if (error) return null;
  const rows = z.array(z.object({ id: z.string(), nickname: text })).safeParse(data);
  if (!rows.success) return null;
  const wanted = query.trim().toLocaleLowerCase();
  return (
    rows.data.find((r) => r.id === wanted || r.nickname?.toLocaleLowerCase() === wanted) ?? null
  );
}

/** This week's period: "week:<its Monday, UTC>". */
export function weekPeriod(now = new Date()): string {
  const day = (now.getUTCDay() + 6) % 7;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day),
  );
  return `week:${monday.toISOString().slice(0, 10)}`;
}

/** The section's URL: `?match=`, `?board=&period=`, `?player=`. */
export function integrityFromUrl(search: string) {
  const params = new URLSearchParams(search);
  const uuid = z.uuid().safeParse(params.get("match"));
  const board = z
    .string()
    .check(z.regex(/^([a-z0-9]+(-[a-z0-9]+)*\.)?[a-z0-9]+(-[a-z0-9]+)*$/), z.maxLength(80))
    .safeParse(params.get("board"));
  const player = z
    .string()
    .check(z.minLength(1), z.maxLength(100))
    .safeParse(params.get("player")?.trim());
  return {
    match: uuid.success ? uuid.data : null,
    board: board.success ? board.data : null,
    week: params.get("period") === "week",
    player: player.success ? player.data : null,
  };
}

/** A board's value: a time (lower is better) as m:ss.s, else a number. */
export function boardValue(value: number, lowerIsBetter: boolean, bcp47: string): string {
  if (!lowerIsBetter) return value.toLocaleString(bcp47);
  const tenths = Math.round(value / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = (tenths % 600) / 10;
  return `${String(minutes)}:${seconds.toLocaleString(bcp47, { minimumIntegerDigits: 2, minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}
