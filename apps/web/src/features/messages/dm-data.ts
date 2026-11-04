// Direct messages (SPEC §8.2): the conversation list, a thread with one
// player, and what arrives live on the player's own channel ('dm',
// 'dm_deleted', 'dm_read', 'typing'). zod/mini: this module ships to the
// browser.
import * as z from "zod/mini";

import { LIVE_EVENT } from "@/features/live/presence-context";
import type { Supabase } from "@/lib/supabase/client";

const card = z.object({
  id: z.string(),
  nickname: z.string(),
  avatarKind: z.string(),
  avatarPreset: z.nullable(z.string()),
  avatarPath: z.nullable(z.string()),
  avatarFrame: z.nullable(z.string()),
});
export type Player = z.infer<typeof card>;

const dmSchema = z.object({
  id: z.number(),
  senderId: z.string(),
  body: z.nullable(z.string()),
  gifId: z.optional(z.nullable(z.string())),
  status: z.string(),
  at: z.string(),
});
export type Dm = z.infer<typeof dmSchema>;

const conversationsSchema = z.array(
  z.object({ with: card, last: z.nullable(dmSchema), unread: z.int(), at: z.string() }),
);
export type Conversation = z.infer<typeof conversationsSchema>[number];

const threadSchema = z.object({
  with: card,
  canWrite: z.boolean(),
  otherRead: z.number(),
  messages: z.array(dmSchema),
});
export type Thread = z.infer<typeof threadSchema>;

/** A page of a thread (and the size of one). */
export const PAGE = 50;

export async function fetchConversations(supabase: Supabase): Promise<Conversation[] | null> {
  const { data, error } = await supabase.rpc("my_conversations");
  if (error) return null;
  const parsed = conversationsSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** The thread with a player, its messages oldest first; null when there's no such player or it's unreadable. */
export async function fetchThread(
  supabase: Supabase,
  userId: string,
  before: number | null,
): Promise<Thread | null> {
  const { data, error } = await supabase.rpc("direct_thread", {
    p_user: userId,
    p_limit: PAGE,
    ...(before === null ? {} : { p_before: before }),
  });
  if (error) return null;
  const parsed = threadSchema.safeParse(data);
  return parsed.success ? { ...parsed.data, messages: parsed.data.messages.toReversed() } : null;
}

/** Sends a DM (text, a GIF, or both): the stored message (masked), or the error. */
export async function sendDm(
  supabase: Supabase,
  userId: string,
  body: string,
  gif?: string,
): Promise<{ message: Dm } | { error: unknown }> {
  const { data, error } = await supabase.rpc("send_direct_message", {
    p_user: userId,
    p_body: body,
    ...(gif ? { p_gif: gif } : {}),
  });
  if (error) return { error };
  const parsed = dmSchema.safeParse(data);
  return parsed.success ? { message: parsed.data } : { error: new Error("invalid") };
}

/** Adds messages in id order without duplicates. */
export function mergeDms(current: readonly Dm[], added: readonly Dm[]): Dm[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of added) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

/** What arrives live, already checked. */
export type LiveDm =
  | { kind: "message"; message: Dm; from: string; to: string }
  | { kind: "deleted"; id: number; from: string; to: string }
  | { kind: "read"; from: string; read: number }
  | { kind: "typing"; from: string };

const liveMessage = z.extend(dmSchema, { from: z.string(), to: z.string() });
const liveDeleted = z.object({ id: z.number(), from: z.string(), to: z.string() });
const liveRead = z.object({ from: z.string(), read: z.number() });
const liveTyping = z.object({ from: z.string() });

/** Calls `handler` with each DM event on the player's channel, until the returned function is called. */
export function onLiveDm(handler: (event: LiveDm) => void): () => void {
  const listener = (event: Event) => {
    const { detail } = event as CustomEvent<{ event?: unknown; payload?: unknown }>;
    if (detail.event === "dm") {
      const parsed = liveMessage.safeParse(detail.payload);
      if (parsed.success) {
        const { from, to, ...message } = parsed.data;
        handler({ kind: "message", message, from, to });
      }
    } else if (detail.event === "dm_deleted") {
      const parsed = liveDeleted.safeParse(detail.payload);
      if (parsed.success) handler({ kind: "deleted", ...parsed.data });
    } else if (detail.event === "dm_read") {
      const parsed = liveRead.safeParse(detail.payload);
      if (parsed.success) handler({ kind: "read", ...parsed.data });
    } else if (detail.event === "typing") {
      const parsed = liveTyping.safeParse(detail.payload);
      if (parsed.success) handler({ kind: "typing", ...parsed.data });
    }
  };
  document.addEventListener(LIVE_EVENT, listener);
  return () => {
    document.removeEventListener(LIVE_EVENT, listener);
  };
}

/** A player id in `?with=`. */
export const PLAYER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
