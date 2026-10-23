// OAuth providers this build offers (SPEC §7.1). Unset means all four, for
// local development with the dev apps from docs/RUNBOOK.md; "none" or a
// comma-separated subset is for builds whose Supabase project hasn't set
// them up (production until Phase 21). A bad value fails the build.
import { z } from "zod/mini";

export const OAUTH_PROVIDERS = ["google", "discord", "twitch", "facebook"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

const providerList = z.array(z.enum(OAUTH_PROVIDERS));

export function parseAuthProviders(value: string | undefined): OAuthProvider[] {
  if (value === undefined) return [...OAUTH_PROVIDERS];
  const names = value
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "" && name !== "none");
  const parsed = providerList.safeParse(names);
  if (!parsed.success) {
    throw new Error(
      `PUBLIC_AUTH_PROVIDERS must be "none" or a list of ${OAUTH_PROVIDERS.join(", ")}; got "${value}"`,
    );
  }
  return parsed.data;
}

export const AUTH_PROVIDERS: readonly OAuthProvider[] = parseAuthProviders(
  import.meta.env.PUBLIC_AUTH_PROVIDERS,
);
