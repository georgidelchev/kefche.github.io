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

/** The current account, or a new guest identity when nobody is signed in. */
export async function ensureIdentity(supabase: Supabase): Promise<Identity> {
  const { data } = await supabase.auth.getSession();
  let session = data.session;
  if (!session) {
    const { data: created, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    session = created.session;
  }
  if (!session) throw new Error("no_session");
  return identityOf(supabase, session.user.id, session.user.is_anonymous === true);
}
