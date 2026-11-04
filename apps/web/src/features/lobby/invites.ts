// Inviting a player to the lobby (Phase 8 step 5): `invite_to_room`, which
// follows the invitee's privacy_invites and blocks. The invite reaches them
// as a notification on their own channel (features/live/invite-toast.ts).
import type { Supabase } from "@/lib/supabase/client";

/** The error codes `invite_to_room` returns (its message) that the lobby words; others are "unknown". */
export const INVITE_ERROR_CODES = [
  "unavailable",
  "already_here",
  "room_locked",
  "room_started",
  "rate_limited",
  "unknown",
] as const;
export type InviteErrorCode = (typeof INVITE_ERROR_CODES)[number];

export function inviteErrorCode(error: unknown): InviteErrorCode {
  const message = (error as { message?: unknown } | null)?.message;
  // A guest, yourself or a deleted player can't be invited, as far as the inviter needs to know.
  if (message === "invalid_user") return "unavailable";
  return (INVITE_ERROR_CODES as readonly unknown[]).includes(message)
    ? (message as InviteErrorCode)
    : "unknown";
}

/** Invites the player; null once sent (or already sent a moment ago), else why not. */
export async function sendInvite(
  supabase: Supabase,
  roomId: string,
  userId: string,
): Promise<InviteErrorCode | null> {
  try {
    const { error } = await supabase.rpc("invite_to_room", { p_room: roomId, p_user: userId });
    return error ? inviteErrorCode(error) : null;
  } catch {
    return "unknown";
  }
}

/** A player id in `?invite=` (from the friends page or a profile). */
export const INVITEE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
