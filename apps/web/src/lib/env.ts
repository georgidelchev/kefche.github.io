import { z } from "zod";

/**
 * Public (browser-exposed) environment variables. Every variable must also be
 * documented in `.env.example`. Only `PUBLIC_*` variables reach client code.
 */
const publicEnvSchema = z.object({
  PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    // Guards against shipping a secret (RLS-bypassing) key to the browser (SPEC §18).
    .startsWith("sb_publishable_", "Must be a Supabase publishable key (sb_publishable_…)."),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/** Validates `source` and throws a readable error listing every invalid variable. */
export function parsePublicEnv(source: Record<string, unknown>): PublicEnv {
  const result = publicEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/**
 * Supabase settings for this build, or null when none are set. Without them
 * the site builds without account features (production until the hosted
 * project exists, SPEC Phase 21). Setting only one, or an invalid value, fails.
 */
export function parseSupabaseEnv(source: Record<string, unknown>): PublicEnv | null {
  const isBlank = (value: unknown) => value === undefined || value === "";
  if (isBlank(source.PUBLIC_SUPABASE_URL) && isBlank(source.PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
    return null;
  }
  return parsePublicEnv(source);
}

let cached: PublicEnv | null | undefined;

/** {@link parseSupabaseEnv} for the running build, parsed once. Server and build time only. */
export function getSupabaseEnv(): PublicEnv | null {
  if (cached === undefined) cached = parseSupabaseEnv(import.meta.env);
  return cached;
}
