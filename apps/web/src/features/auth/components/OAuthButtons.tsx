import { useState } from "react";

import { Button } from "@kefche/ui/components/button";

import { AUTH_PROVIDERS, type OAuthProvider } from "@/lib/auth-providers";
import { getSupabase } from "@/lib/supabase/client";

import { authErrorKey } from "../errors";
import { guestSession, rememberGuest } from "../guest";
import { FormMessage } from "./fields";

import type { AuthPaths } from "../paths";
import type { AuthStrings } from "../strings";

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

/**
 * The "or" line and a sign-in button per OAuth provider this build offers
 * (SPEC §7.1); returns to the callback page. Nothing when none are offered.
 */
export function OAuthButtons({ strings, paths, mode }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWith(provider: OAuthProvider) {
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

  if (AUTH_PROVIDERS.length === 0) return null;
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        {strings.signIn.or}
        <span className="h-px flex-1 bg-border" />
      </div>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      {AUTH_PROVIDERS.map((provider) => (
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
