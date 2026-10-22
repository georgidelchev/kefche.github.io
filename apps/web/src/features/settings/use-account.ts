import { useEffect, useState } from "react";

import { getSupabase, type Supabase } from "@/lib/supabase/client";

import type { User } from "@supabase/supabase-js";

export type AccountState =
  { status: "loading" } | { status: "ready"; supabase: Supabase; user: User } | { status: "error" };

/**
 * The signed-in, registered user for a settings island. Anyone else is sent
 * to sign in and comes back here afterwards.
 */
export function useAccount(signInPath: string): AccountState {
  const [state, setState] = useState<AccountState>({ status: "loading" });
  useEffect(() => {
    void (async () => {
      try {
        const supabase = await getSupabase();
        const user = supabase ? (await supabase.auth.getUser()).data.user : null;
        if (!supabase || !user || user.is_anonymous === true) {
          location.replace(`${signInPath}?next=${encodeURIComponent(location.pathname)}`);
          return;
        }
        setState({ status: "ready", supabase, user });
      } catch {
        setState({ status: "error" });
      }
    })();
  }, [signInPath]);
  return state;
}
