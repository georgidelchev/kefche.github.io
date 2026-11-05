import { z } from "zod/mini";

import type { Env } from "./env";

const entrySchema = z.object({ id: z.uuid(), name: z.string(), guest: z.boolean() });
const errorSchema = z.object({ message: z.string() });

export interface ArenaPlayer {
  userId: string;
  name: string;
  guest: boolean;
}

export type EntryError = "invalid_token" | "nickname_required" | "suspended";

/**
 * Who a Supabase access token belongs to, as `public.arena_entry` answers
 * with that token: an account or a guest with a name, and not suspended or
 * banned. PostgREST checks the token's signature and expiry.
 */
export async function arenaEntry(env: Env, token: string): Promise<ArenaPlayer | EntryError> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/arena_entry`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) {
    const entry = entrySchema.safeParse(body);
    return entry.success
      ? { userId: entry.data.id, name: entry.data.name, guest: entry.data.guest }
      : "invalid_token";
  }
  const message = errorSchema.safeParse(body);
  if (
    message.success &&
    (message.data.message === "nickname_required" || message.data.message === "suspended")
  ) {
    return message.data.message;
  }
  return "invalid_token";
}
