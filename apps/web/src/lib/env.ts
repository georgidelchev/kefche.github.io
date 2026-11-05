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

const arenaUrlSchema = z.url({ protocol: /^https?$/ });

/**
 * The real-time arena server (Phase 9) for `source`, without a trailing
 * slash, or null when PUBLIC_ARENA_URL isn't set (arena games then play the
 * solo arena only). An invalid value fails.
 */
export function parseArenaUrl(source: Record<string, unknown>): string | null {
  const value = source.PUBLIC_ARENA_URL;
  if (value === undefined || value === "") return null;
  const parsed = arenaUrlSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data.replace(/\/$/, "");
}

/** {@link parseArenaUrl} for the running build. Server and build time only. */
export const getArenaUrl = (): string | null => parseArenaUrl(import.meta.env);

let cached: PublicEnv | null | undefined;

/** {@link parseSupabaseEnv} for the running build, parsed once. Server and build time only. */
export function getSupabaseEnv(): PublicEnv | null {
  if (cached === undefined) cached = parseSupabaseEnv(import.meta.env);
  return cached;
}
