// Server-side reads of game history for Worker-rendered pages (SPEC §7.2,
// §12.2): a player's ratings and recent games for their public profile, and
// one finished game for its own page. Public data only, read with the
// publishable key (only counted matches are readable).
import { z } from "zod";

import { timerPresetSchema } from "@kefche/game-sdk/manifest-schema";

import type { PublicEnv } from "@/lib/env";

const playerSchema = z.object({
  seat: z.number().int(),
  /** Null once the player's account is deleted. */
  nickname: z.string().nullable(),
  outcome: z.number(),
  ratingBefore: z.number().nullable(),
  ratingAfter: z.number().nullable(),
});
export type MatchPlayer = z.infer<typeof playerSchema>;

const matchSummarySchema = z.object({
  id: z.uuid(),
  gameId: z.string(),
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

const historySchema = z.object({
  ratings: z.array(ratingSchema),
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

/** A player's ratings and latest counted games, or null if they couldn't be read. */
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
