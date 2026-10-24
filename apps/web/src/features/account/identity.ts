// Who the player is in online rooms (SPEC §7.1). A signed-in account is used
// as it is. Otherwise a guest (anonymous) identity is created the first time
// it's needed, when joining or creating a room, never on page load.
import type { Supabase } from "@/lib/supabase/client";

export interface Identity {
  userId: string;
  guest: boolean;
  /** Null until a guest picks one (or an account finishes onboarding). */
  nickname: string | null;
}

export async function identityOf(
  supabase: Supabase,
  userId: string,
  guest: boolean,
): Promise<Identity> {
  const { data, error } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return { userId, guest, nickname: data?.nickname ?? null };
}

// Auth error codes meaning the stored session's user is gone on the server.
const GONE = new Set(["user_not_found", "session_not_found", "refresh_token_not_found", "bad_jwt"]);

/**
 * The stored session, if the server still knows its user. A session can
 * outlive its user (an account deleted elsewhere, or a reset local
 * database); then it's dropped from this browser and the caller starts
 * over. Network errors are thrown, never treated as a missing user.
 */
async function liveSession(supabase: Supabase) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const { error } = await supabase.auth.getUser();
  if (!error) return data.session;
  if (!GONE.has(error.code ?? "")) throw error;
  await supabase.auth.signOut({ scope: "local" });
  return null;
}

/** The current account, or a new guest identity when nobody is signed in. */
export async function ensureIdentity(supabase: Supabase): Promise<Identity> {
  let session = await liveSession(supabase);
  if (!session) {
    const { data: created, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    session = created.session;
  }
  if (!session) throw new Error("no_session");
  return identityOf(supabase, session.user.id, session.user.is_anonymous === true);
}
