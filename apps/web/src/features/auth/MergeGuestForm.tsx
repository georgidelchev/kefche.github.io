import { useEffect, useState } from "react";

import { Button } from "@kefche/ui/components/button";

import { getSupabase } from "@/lib/supabase/client";

import { FormMessage } from "./components/fields";
import { forgetGuest, guestAccessToken, pendingMerge } from "./guest";
import { nextFromLocation, routeAfterSignIn } from "./session";

import type { AuthPaths } from "./paths";
import type { AuthStrings } from "./strings";

/**
 * Shown after a guest signs in to an existing account (SPEC §7.1): move the
 * guest's progress into it (merge-guest Edge Function), or leave it behind.
 */
export function MergeGuestForm({ strings, paths }: { strings: AuthStrings; paths: AuthPaths }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Nothing remembered (e.g. reloaded in another tab): carry on.
  useEffect(() => {
    if (pendingMerge()) return;
    void getSupabase()?.then((supabase) => routeAfterSignIn(supabase, paths, nextFromLocation()));
  }, [paths]);

  async function finish(move: boolean) {
    setBusy(true);
    setFailed(false);
    const supabase = await getSupabase();
    if (!supabase) return;
    const guest = pendingMerge();
    try {
      if (move && guest) {
        const result = await supabase.functions.invoke<{ merged: true }>("merge-guest", {
          body: { guestAccessToken: await guestAccessToken(guest) },
        });
        if (result.error) throw result.error;
      }
    } catch {
      setFailed(true);
      setBusy(false);
      return;
    }
    forgetGuest();
    await routeAfterSignIn(supabase, paths, nextFromLocation());
  }

  return (
    <div className="grid gap-3">
      {failed && <FormMessage tone="error">{strings.merge.failed}</FormMessage>}
      <Button
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={() => {
          void finish(true);
        }}
      >
        {strings.merge.confirm}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => {
          void finish(false);
        }}
      >
        {strings.merge.skip}
      </Button>
    </div>
  );
}
