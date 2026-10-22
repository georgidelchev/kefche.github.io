import { useState } from "react";

import { Button } from "@kefche/ui/components/button";

import { getSupabase } from "@/lib/supabase/client";

import { authErrorKey } from "../errors";
import { FormMessage } from "./fields";

import type { AuthPaths } from "../paths";
import type { AuthStrings } from "../strings";

const PROVIDERS = ["google", "discord", "twitch", "facebook"] as const;

/** Sign-in with each OAuth provider (SPEC §7.1); returns to the callback page. */
export function OAuthButtons({ strings, paths }: { strings: AuthStrings; paths: AuthPaths }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWith(provider: (typeof PROVIDERS)[number]) {
    setPending(true);
    setError(null);
    try {
      const supabase = await getSupabase();
      if (!supabase) return;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: new URL(paths.callback, location.origin).href },
      });
      // On success the browser is already navigating to the provider.
      if (oauthError) throw oauthError;
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
