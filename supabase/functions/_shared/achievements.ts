// Achievements after a counted game (Phase 7 step 8, SPEC §12.6). Every
// account in the match gets the tiers its stats now reach (the SDK's
// reachedTiers, with each game's definitions); the database keeps the new
// ones, with the match that unlocked them, and awards their XP. Failures are
// logged and swallowed: the game is counted either way, and the next one
// unlocks whatever this one missed.
import type { SupabaseClient } from "@supabase/supabase-js";
import * as z from "zod";

import { levelForXp, type PlayerFigures, reachedTiers } from "./engines.ts";
import { log } from "./http.ts";

const count = z.number().int().nonnegative();
const figuresSchema = z.object({
  games: z.record(
    z.string(),
    z.object({
      played: count,
      wins: count,
      bestScore: z.number().nullable(),
      bestTimeMs: z.number().nullable(),
      bestStreak: count,
      rating: z.number().nullable(),
    }),
  ),
  matches: z.coerce.number().int().nonnegative(),
  gamesTried: z.coerce.number().int().nonnegative(),
  xp: z.coerce.number().int().nonnegative(),
});

/** A player's figures from achievement_figures, with the level worked out from the XP. */
export function figuresFrom(raw: unknown): PlayerFigures {
  const { games, matches, gamesTried, xp } = figuresSchema.parse(raw);
  return { games, matches, gamesTried, level: levelForXp(xp) };
}

export const unlockSchema = z.object({
  achievement: z.string(),
  tier: z.enum(["bronze", "silver", "gold"]),
});
export type Unlock = z.infer<typeof unlockSchema>;

/** Unlocks what each account in a newly counted match has reached. */
export async function unlockForMatch(admin: SupabaseClient, matchId: string): Promise<void> {
  try {
    const players = await admin
      .from("match_participants")
      .select("user_id")
      .eq("match_id", matchId)
      .not("user_id", "is", null);
    if (players.error) throw new Error(`participants: ${players.error.message}`);
    for (const { user_id: user } of players.data) {
      const figures = await admin.rpc("achievement_figures", { p_user: user });
      if (figures.error) throw new Error(`achievement_figures: ${figures.error.message}`);
      const reached = reachedTiers(figuresFrom(figures.data));
      if (reached.length === 0) continue;
      const added = await admin.rpc("achievements_unlock", {
        p_user: user,
        p_match: matchId,
        p_unlocks: reached,
      });
      if (added.error) throw new Error(`achievements_unlock: ${added.error.message}`);
      if (added.data) log("info", "achievements", { user, match: matchId, added: added.data });
    }
  } catch (e) {
    log("error", "achievements_failed", {
      match: matchId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

const rewardsSchema = z.object({
  xpGained: z.coerce.number().int().nonnegative(),
  xp: z.coerce.number().int().nonnegative(),
  achievements: z.array(unlockSchema),
  best: z.object({ score: z.number().nullable(), timeMs: z.number().nullable() }).nullable(),
  /** The player's play streak since (step 12), or null before their first. */
  streak: z.object({ current: z.number().int(), best: z.number().int() }).nullable(),
  /** Avatar frames the match unlocked. */
  frames: z.array(z.string()),
});
/**
 * What a match gave a player: its XP, their total since, its achievements,
 * their best, their play streak and the frames it unlocked.
 */
export type Rewards = z.infer<typeof rewardsSchema>;

/** A match's rewards for a player (for their results screen), or null if they can't be read. */
export async function rewardsFor(
  admin: SupabaseClient,
  matchId: string,
  userId: string,
): Promise<Rewards | null> {
  const { data, error } = await admin.rpc("match_rewards", { p_match: matchId, p_user: userId });
  const parsed = error ? null : rewardsSchema.safeParse(data);
  if (!parsed?.success) {
    log("error", "rewards_read_failed", { match: matchId, error: error?.message ?? "shape" });
    return null;
  }
  return parsed.data;
}
