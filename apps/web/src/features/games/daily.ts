// The daily challenge in the browser (Phase 7 step 11, SPEC §12.7): today's
// game, settings and seed for anyone (`daily_challenge`, without loading
// supabase-js), and a play of it for an account (`start_daily`), so its
// result is recorded like any game played alone. A guest plays it on the
// same seed, unrecorded.
// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import { getSupabase } from "@/lib/supabase/client";
import { supabaseConfig } from "@/lib/supabase/config";

import { isAccount, type Play } from "./plays";

const dailySchema = z.object({
  day: z.string(),
  gameId: z.string().check(z.maxLength(40)),
  config: z.record(z.string(), z.unknown()),
  seed: z.string().check(z.minLength(1), z.maxLength(64)),
  endsAt: z.string(),
});
export type DailyChallenge = z.infer<typeof dailySchema>;

/** Today's challenge, or null if it can't be read (or the build has no Supabase). */
export async function fetchDaily(): Promise<DailyChallenge | null> {
  if (!supabaseConfig) return null;
  const res = await fetch(new URL("/rest/v1/rpc/daily_challenge", supabaseConfig.url), {
    method: "POST",
    headers: { apikey: supabaseConfig.key, "content-type": "application/json" },
    body: "{}",
  }).catch(() => null);
  if (!res?.ok) return null;
  const parsed = dailySchema.safeParse(await res.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

const playSchema = z.object({
  id: z.string().check(z.minLength(1), z.maxLength(64)),
  seed: z.string().check(z.minLength(1), z.maxLength(64)),
});

/** A play of today's challenge for an account, or null (a guest, or no network). */
export async function startDaily(version: number): Promise<Play | null> {
  if (!isAccount()) return null;
  const supabase = await getSupabase();
  const reply = await supabase?.rpc("start_daily", { p_game_version: version });
  if (!reply || reply.error) return null;
  const parsed = playSchema.safeParse(reply.data);
  return parsed.success ? parsed.data : null;
}
