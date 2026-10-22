// Completes a sign-in that arrives by redirect (no framework):
// - OAuth (PKCE): ?code=…
// - Email links (custom templates in supabase/templates): ?token_hash=…&type=…
//   This works even when the email is opened in another browser.
// Then routes to the new-password page (recovery), onboarding, or home.
import { getSupabase } from "@/lib/supabase/client";

import { routeAfterSignIn } from "./session";

import type { AuthPaths } from "./paths";
import type { EmailOtpType } from "@supabase/supabase-js";

const EMAIL_TYPES = new Set<string>(["email", "signup", "recovery", "email_change"]);
const isEmailType = (value: string | null): value is EmailOtpType =>
  value !== null && EMAIL_TYPES.has(value);

async function complete(paths: AuthPaths): Promise<void> {
  const params = new URLSearchParams(location.search);
  const supabase = await getSupabase();
  if (!supabase || params.has("error")) throw new Error("sign-in failed");

  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } else if (tokenHash && isEmailType(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) throw error;
  } else {
    throw new Error("nothing to complete");
  }

  // One-time codes shouldn't linger in history.
  history.replaceState(null, "", location.pathname);
  if (type === "recovery") {
    location.replace(paths.reset);
    return;
  }
  await routeAfterSignIn(supabase, paths, null);
}

const root = document.querySelector<HTMLElement>("[data-auth-callback]");
if (root?.dataset.paths) {
  const paths = JSON.parse(root.dataset.paths) as AuthPaths;
  complete(paths).catch(() => {
    root.querySelector<HTMLElement>("[data-working]")?.toggleAttribute("hidden", true);
    root.querySelector<HTMLElement>("[data-failed]")?.toggleAttribute("hidden", false);
  });
}
