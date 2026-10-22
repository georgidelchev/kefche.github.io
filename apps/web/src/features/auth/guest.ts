// Guest (anonymous) sessions during sign-in (SPEC §7.1).
// - Creating an account as a guest upgrades the guest in place (same user id).
// - Signing in to an existing account replaces the guest session, so the
//   guest's tokens are kept in sessionStorage until the merge page asks
//   whether to move the guest's progress into the account.
// zod/mini: ships to the browser.
import * as z from "zod/mini";

import type { Supabase } from "@/lib/supabase/client";
import { supabaseConfig } from "@/lib/supabase/config";

import type { Session } from "@supabase/supabase-js";

const PENDING_MERGE_KEY = "kefche:guest-merge";

const pendingMergeSchema = z.object({
  userId: z.string().check(z.minLength(1)),
  accessToken: z.string().check(z.minLength(20)),
  refreshToken: z.string().check(z.minLength(1)),
});
export type PendingMerge = z.infer<typeof pendingMergeSchema>;

/** The current session if it belongs to a guest, else null. */
export async function guestSession(supabase: Supabase): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.is_anonymous === true ? data.session : null;
}

/** Remembers the guest before signing in to another account. */
export function rememberGuest(session: Session): void {
  const pending: PendingMerge = {
    userId: session.user.id,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  };
  try {
    sessionStorage.setItem(PENDING_MERGE_KEY, JSON.stringify(pending));
  } catch {
    // Without storage the merge offer is skipped; the guest stays as it was.
  }
}

export function pendingMerge(): PendingMerge | null {
  try {
    const raw = sessionStorage.getItem(PENDING_MERGE_KEY);
    const result = raw === null ? null : pendingMergeSchema.safeParse(JSON.parse(raw));
    return result?.success ? result.data : null;
  } catch {
    return null;
  }
}

export function forgetGuest(): void {
  try {
    sessionStorage.removeItem(PENDING_MERGE_KEY);
  } catch {
    // Nothing stored.
  }
}

/**
 * A valid access token for the remembered guest, refreshing it if needed.
 * Uses the Auth API directly so the signed-in session isn't touched.
 */
export async function guestAccessToken(guest: PendingMerge): Promise<string> {
  if (!supabaseConfig) throw new Error("no Supabase in this build");
  const { url, key } = supabaseConfig;
  const part = guest.accessToken.split(".")[1] ?? "";
  const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
  if ((payload.exp ?? 0) * 1000 > Date.now() + 60_000) return guest.accessToken;
  const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: key, "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: guest.refreshToken }),
  });
  const body = (await res.json()) as { access_token?: unknown };
  if (!res.ok || typeof body.access_token !== "string") throw new Error("guest session expired");
  return body.access_token;
}
