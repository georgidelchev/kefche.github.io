// What the friends page and profiles read (SPEC §8.1): the `my_friends` and
// `profile_relation` RPCs, validated. zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import type { Supabase } from "@/lib/supabase/client";

const card = z.object({
  id: z.string(),
  nickname: z.string(),
  avatarKind: z.string(),
  avatarPreset: z.nullable(z.string()),
  avatarPath: z.nullable(z.string()),
  avatarFrame: z.nullable(z.string()),
});
export type PlayerCard = z.infer<typeof card>;

const friendsSchema = z.object({
  friends: z.array(z.extend(card, { since: z.string() })),
  incoming: z.array(z.extend(card, { at: z.string() })),
  outgoing: z.array(z.extend(card, { at: z.string() })),
  blocked: z.array(z.extend(card, { at: z.string() })),
});
export type MyFriends = z.infer<typeof friendsSchema>;

export type Friendship = "none" | "requested" | "incoming" | "friends";

const relationSchema = z.object({
  friendship: z.enum(["none", "requested", "incoming", "friends"]),
  blocked: z.boolean(),
  mutual: z.object({ count: z.int(), players: z.array(card) }),
});
export type ProfileRelation = z.infer<typeof relationSchema>;

/** The signed-in player's friends, requests and blocks, or null when unreadable. */
export async function fetchMyFriends(supabase: Supabase): Promise<MyFriends | null> {
  const { data, error } = await supabase.rpc("my_friends");
  if (error) return null;
  const parsed = friendsSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** What the viewer is to this player, or null (own profile, or unreadable). */
export async function fetchRelation(
  supabase: Supabase,
  userId: string,
): Promise<ProfileRelation | null> {
  const { data, error } = await supabase.rpc("profile_relation", { p_user: userId });
  if (error) return null;
  const parsed = relationSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** The error codes friend actions return (their message), each with a translation. */
export const FRIEND_ERROR_CODES = [
  "invalid_user",
  "unavailable",
  "too_many_requests",
  "too_many_blocks",
  "rate_limited",
  "accounts_only",
  "unknown",
] as const;
export type FriendErrorCode = (typeof FRIEND_ERROR_CODES)[number];

export function friendErrorCode(error: unknown): FriendErrorCode {
  const message = (error as { message?: unknown } | null)?.message;
  return (FRIEND_ERROR_CODES as readonly unknown[]).includes(message)
    ? (message as FriendErrorCode)
    : "unknown";
}
