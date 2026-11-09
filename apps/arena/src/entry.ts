import { z } from "zod/mini";

import type { PlayerProgress } from "@kefche/game-sdk";

import type { Env } from "./env";

const entrySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  guest: z.boolean(),
  // From 20261105100500_arena_skins.sql; a database from before it answers neither.
  level: z.optional(z.number().check(z.int())),
  tiers: z.optional(z.array(z.string())),
});
const errorSchema = z.object({ message: z.string() });

export interface ArenaPlayer {
  userId: string;
  name: string;
  guest: boolean;
  /** Their level and unlocked tiers in the game, for the skins they may wear. */
  progress: PlayerProgress;
}

export type EntryError = "invalid_token" | "nickname_required" | "suspended" | "game_disabled";

/**
 * Who a Supabase access token belongs to, as `public.arena_entry` answers
 * with that token: an account or a guest with a name, and not suspended or
 * banned, with their progress in `gameId`. PostgREST checks the token's
 * signature and expiry. A game an admin turned off is refused (game_disabled).
 */
export async function arenaEntry(
  env: Env,
  token: string,
  gameId: string,
): Promise<ArenaPlayer | EntryError> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/arena_entry`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_game: gameId }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) {
    const entry = entrySchema.safeParse(body);
    if (!entry.success) return "invalid_token";
    const { id, name, guest, level = 1, tiers = [] } = entry.data;
    return { userId: id, name, guest, progress: { level, tiers } };
  }
  const message = errorSchema.safeParse(body);
  if (
    message.success &&
    (message.data.message === "nickname_required" ||
      message.data.message === "suspended" ||
      message.data.message === "game_disabled")
  ) {
    return message.data.message;
  }
  return "invalid_token";
}
