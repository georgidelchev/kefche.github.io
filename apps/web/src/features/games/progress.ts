// A player's progress for a game's cosmetic unlocks (context.progress, Phase
// 9 step 10): their level and the tiers they've unlocked in the game. Only
// accounts unlock anything, so nobody else loads supabase-js for it. Never
// rejects: anything that goes wrong is no progress, and the free skins.
import { NO_PROGRESS, type PlayerProgress } from "@kefche/game-sdk";

import { getSupabase } from "@/lib/supabase/client";

import { isAccount } from "./plays";

export async function playerProgress(gameId: string): Promise<PlayerProgress> {
  if (!isAccount()) return NO_PROGRESS;
  try {
    const supabase = await getSupabase();
    if (!supabase) return NO_PROGRESS;
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return NO_PROGRESS;
    const [profile, unlocks] = await Promise.all([
      supabase.from("profiles").select("level").eq("id", user.id).maybeSingle(),
      supabase
        .from("achievement_unlocks")
        .select("achievement, tier")
        .eq("user_id", user.id)
        .like("achievement", `${gameId}.%`),
    ]);
    const prefix = `${gameId}.`;
    return {
      level: profile.data?.level ?? 1,
      tiers: (unlocks.data ?? [])
        .filter((u) => u.achievement.startsWith(prefix))
        .map((u) => `${u.achievement.slice(prefix.length)}.${u.tier}`),
    };
  } catch {
    return NO_PROGRESS;
  }
}
