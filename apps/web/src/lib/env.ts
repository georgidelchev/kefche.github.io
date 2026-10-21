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

let cached: PublicEnv | undefined;

/** Validated public env for the running app, parsed once on first use. */
export function getPublicEnv(): PublicEnv {
  cached ??= parsePublicEnv(import.meta.env);
  return cached;
}
