import { useState } from "react";

import { Button } from "@kefche/ui/components/button";

import { getSupabase } from "@/lib/supabase/client";

import { authErrorKey } from "../errors";
import { guestSession, rememberGuest } from "../guest";
import { FormMessage } from "./fields";

import type { AuthPaths } from "../paths";
import type { AuthStrings } from "../strings";

const PROVIDERS = ["google", "discord", "twitch", "facebook"] as const;

interface Props {
  strings: AuthStrings;
  paths: AuthPaths;
  /**
   * signUp: a guest links the provider to the guest account (same user id).
   * signIn: a guest signs in to that provider's account; the merge page then
   * offers to move the guest's progress.
   */
  mode: "signIn" | "signUp";
}

/** Sign-in with each OAuth provider (SPEC §7.1); returns to the callback page. */
export function OAuthButtons({ strings, paths, mode }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWith(provider: (typeof PROVIDERS)[number]) {
    setPending(true);
    setError(null);
    try {
      const supabase = await getSupabase();
      if (!supabase) return;
      const options = { redirectTo: new URL(paths.callback, location.origin).href };
      const guest = await guestSession(supabase);
      if (guest && mode === "signUp") {
        const { error: linkError } = await supabase.auth.linkIdentity({ provider, options });
        if (linkError) throw linkError;
      } else {
        if (guest) rememberGuest(guest);
        const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider, options });
        if (oauthError) throw oauthError;
      }
      // On success the browser is already navigating to the provider.
    } catch (e) {
      setError(strings.errors[authErrorKey(e)]);
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      {error && <FormMessage tone="error">{error}</FormMessage>}
      {PROVIDERS.map((provider) => (
        <Button
          key={provider}
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            void signInWith(provider);
          }}
        >
          {strings.oauth[provider]}
        </Button>
      ))}
    </div>
  );
}
