// What a finished game gave the player, as submit-match answers it (Phase 7
// step 9): the XP it earned, their total since, the achievements it unlocked
// and their best in that game. The results screen shows it.
// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

const tier = z.enum(["bronze", "silver", "gold"]);

export const rewardsSchema = z.object({
  xpGained: z.int().check(z.minimum(0)),
  xp: z.int().check(z.minimum(0)),
  achievements: z.array(z.object({ achievement: z.string().check(z.maxLength(80)), tier })),
  best: z.nullable(z.object({ score: z.nullable(z.number()), timeMs: z.nullable(z.number()) })),
});
export type Rewards = z.infer<typeof rewardsSchema>;

/** The part of submit-match's answer the results screen reads. */
const answerSchema = z.object({
  matchId: z.nullable(z.string()),
  status: z.optional(z.string()),
  rewards: z.optional(z.nullable(rewardsSchema)),
});

/**
 * A game's rewards from submit-match's answer, or null when there are none
 * to show: no match yet, set aside for review, or an answer it can't read.
 */
export function rewardsFrom(answer: unknown): { matchId: string | null; rewards: Rewards | null } {
  const parsed = answerSchema.safeParse(answer);
  if (!parsed.success) return { matchId: null, rewards: null };
  const { matchId, status, rewards } = parsed.data;
  return { matchId, rewards: status === "review" ? null : (rewards ?? null) };
}

/**
 * What the results screen shows below the result: nothing (a game that isn't
 * recorded, or someone watching), a nudge to sign in (a guest), "saving"
 * while the server checks the game, then the rewards.
 */
export type RewardsState =
  { kind: "none" } | { kind: "guest" } | { kind: "saving" } | { kind: "done"; rewards: Rewards };

export const rewardsState = (rewards: Rewards | null): RewardsState =>
  rewards ? { kind: "done", rewards } : { kind: "none" };
