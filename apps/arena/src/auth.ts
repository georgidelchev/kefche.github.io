import { z } from "zod/mini";

import type { Env } from "./env";

const userSchema = z.object({ id: z.uuid(), is_anonymous: z.optional(z.boolean()) });

export interface ArenaUser {
  id: string;
  guest: boolean;
}

/**
 * The player behind a Supabase access token (an account or a guest), asked
 * of Supabase Auth itself, so a revoked session or a banned player is
 * refused. Null when the token isn't valid.
 */
export async function verifyToken(env: Env, token: string): Promise<ArenaUser | null> {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const user = userSchema.safeParse(await response.json());
  return user.success ? { id: user.data.id, guest: user.data.is_anonymous === true } : null;
}
