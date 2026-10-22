import { syncAccount } from "@/features/account/account-state";
import type { Supabase } from "@/lib/supabase/client";

import type { AuthPaths } from "./paths";

/** `?next=` target if it's a same-site path; anything else is ignored. */
export function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  return raw;
}

/** The current URL's `?next=`, validated. */
export const nextFromLocation = () => safeNext(new URLSearchParams(location.search).get("next"));

/** True when the account still lacks a nickname or a birth year (OAuth, guests, admin-created). */
export async function needsOnboarding(supabase: Supabase, userId: string): Promise<boolean> {
  const [profile, settings] = await Promise.all([
    supabase.from("profiles").select("nickname").eq("id", userId).maybeSingle(),
    supabase.from("user_settings").select("birth_year").eq("user_id", userId).maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  if (settings.error) throw settings.error;
  return !profile.data?.nickname || settings.data?.birth_year == null;
}

/**
 * Where to go once a session exists: onboarding when the account is
 * incomplete, otherwise `next` or home. Also refreshes the header summary.
 */
export async function routeAfterSignIn(supabase: Supabase, paths: AuthPaths, next: string | null) {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  await syncAccount(supabase);
  if (await needsOnboarding(supabase, data.user.id)) {
    const target = new URL(paths.onboarding, location.origin);
    if (next) target.searchParams.set("next", next);
    location.assign(target.pathname + target.search);
  } else {
    location.assign(next ?? paths.home);
  }
}
