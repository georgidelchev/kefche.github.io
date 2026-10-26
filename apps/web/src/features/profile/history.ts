// Server-side reads of game history for Worker-rendered pages (SPEC §7.2,
// §12.2): a player's ratings and recent games for their public profile, and
// one finished game for its own page. Public data only, read with the
// publishable key (only counted matches are readable). Every mode is here
// since Phase 7: alone, against bots, online and races.
import { z } from "zod";

import { timerPresetSchema } from "@kefche/game-sdk/manifest-schema";

import type { PublicEnv } from "@/lib/env";

const playerSchema = z.object({
  seat: z.number().int(),
  /**
   * Null for a seat without an account: a bot, a guest, a second player on
   * one device, or an account since deleted.
   */
  nickname: z.string().nullable(),
  /** 1 win, 0.5 draw, 0 loss; null for a game played alone or in a race. */
  outcome: z.number().nullable(),
  score: z.number().nullable().default(null),
  timeMs: z.number().nullable().default(null),
  /** The bot's difficulty, for a bot's seat. */
  bot: z.enum(["easy", "medium", "hard"]).nullable().default(null),
  ratingBefore: z.number().nullable(),
  ratingAfter: z.number().nullable(),
});
export type MatchPlayer = z.infer<typeof playerSchema>;

const matchSummarySchema = z.object({
  id: z.uuid(),
  gameId: z.string(),
  rated: z.boolean(),
  pool: z.string().nullable(),
  timer: timerPresetSchema,
  reason: z.string(),
  endedAt: z.string(),
  /** The profile owner's seat. */
  seat: z.number().int(),
  players: z.array(playerSchema),
});
export type MatchSummary = z.infer<typeof matchSummarySchema>;

const ratingSchema = z.object({
  gameId: z.string(),
  pool: z.string(),
  rating: z.number(),
  rd: z.number(),
  games: z.number().int(),
});
export type PlayerRating = z.infer<typeof ratingSchema>;

/** A player's stats in one game (SPEC §12.1). */
const gameStatsSchema = z.object({
  gameId: z.string(),
  played: z.number().int(),
  wins: z.number().int(),
  losses: z.number().int(),
  draws: z.number().int(),
  bestScore: z.number().nullable(),
  bestTimeMs: z.number().nullable(),
  averageScore: z.number().nullable(),
  timePlayedMs: z.number(),
  streak: z.number().int(),
  bestStreak: z.number().int(),
  lastPlayedAt: z.string().nullable(),
});
export type GameStats = z.infer<typeof gameStatsSchema>;

/** Across games. */
const totalsSchema = z.object({
  matches: z.number().int(),
  timePlayedMs: z.number(),
  gamesTried: z.number().int(),
  favoriteGame: z.string().nullable(),
});
export type PlayerTotals = z.infer<typeof totalsSchema>;

/** One pool's rating after each of its latest rated games, oldest first. */
const ratingSeriesSchema = z.object({
  gameId: z.string(),
  pool: z.string(),
  /** The rating before the first of these games. */
  start: z.number().nullable(),
  points: z.array(z.object({ at: z.string(), rating: z.number() })),
});
export type RatingSeries = z.infer<typeof ratingSeriesSchema>;

const historySchema = z.object({
  ratings: z.array(ratingSchema),
  stats: z.array(gameStatsSchema),
  totals: totalsSchema.nullable(),
  ratingHistory: z.array(ratingSeriesSchema),
  matches: z.array(matchSummarySchema),
});
export type PlayerHistory = z.infer<typeof historySchema>;

const matchSchema = z.object({
  id: z.uuid(),
  gameId: z.string(),
  gameVersion: z.number().int(),
  rated: z.boolean(),
  pool: z.string().nullable(),
  timer: timerPresetSchema,
  reason: z.string(),
  pgn: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string(),
  players: z.array(playerSchema),
});
export type MatchRecord = z.infer<typeof matchSchema>;

/** Fewer rated games than this in a pool, and the rating is provisional (SPEC §12.3). */
export const PROVISIONAL_GAMES = 10;

async function rpc(
  env: PublicEnv,
  name: string,
  args: Record<string, unknown>,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const res = await fetchImpl(new URL(`/rest/v1/rpc/${name}`, env.PUBLIC_SUPABASE_URL), {
    method: "POST",
    headers: {
      apikey: env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${name}: ${String(res.status)}`);
  return res.json();
}

/**
 * A player's ratings and their history, stats, and latest counted games, or
 * null if they couldn't be read.
 */
export async function fetchPlayerHistory(
  env: PublicEnv,
  userId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PlayerHistory | null> {
  try {
    const data = await rpc(env, "player_history", { p_user: userId, p_limit: 20 }, fetchImpl);
    const parsed = historySchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type MatchLookup =
  { status: "found"; match: MatchRecord } | { status: "missing" } | { status: "error" };

/** One counted match by id. */
export async function fetchMatch(
  env: PublicEnv,
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MatchLookup> {
  if (!z.uuid().safeParse(id).success) return { status: "missing" };
  try {
    const data = await rpc(env, "match_record", { p_match: id }, fetchImpl);
    if (data === null) return { status: "missing" };
    const parsed = matchSchema.safeParse(data);
    return parsed.success ? { status: "found", match: parsed.data } : { status: "error" };
  } catch {
    return { status: "error" };
  }
}
