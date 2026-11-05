// A room's lobby chat (SPEC §8.2): the latest messages, then new ones as
// Realtime delivers them (RLS decides who receives them). Messages are
// written only through send_room_message, which masks and rate-limits.
// Removed messages (deleted, or hidden by reports) arrive on the room's
// private channel `room-chat:<room id>`, which only the database writes.
import * as z from "zod/mini";

import type { Supabase } from "@/lib/supabase/client";

export interface ChatMessage {
  id: number;
  userId: string;
  nickname: string;
  body: string;
  at: number;
  /** Hidden by reports: only its sender still reads it. */
  hidden: boolean;
}

/** How many messages the chat shows (and loads when it opens). */
export const CHAT_HISTORY = 50;

const row = z.object({
  id: z.number(),
  user_id: z.string(),
  nickname: z.string(),
  body: z.string(),
  created_at: z.string(),
  hidden: z.optional(z.boolean()),
});

/** A message row from the database or Realtime, or null when malformed. */
export function chatMessage(raw: unknown): ChatMessage | null {
  const parsed = row.safeParse(raw);
  if (!parsed.success) return null;
  const { id, user_id, nickname, body, created_at, hidden } = parsed.data;
  return {
    id,
    userId: user_id,
    nickname,
    body,
    at: Date.parse(created_at),
    hidden: hidden === true,
  };
}

/** Adds messages in id order, without duplicates, keeping the latest CHAT_HISTORY. */
export function mergeMessages(
  current: readonly ChatMessage[],
  added: readonly ChatMessage[],
): ChatMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of added) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id).slice(-CHAT_HISTORY);
}

/**
 * Calls `onMessages` with the latest messages, then with each new one, and
 * `onRemoved` with each removed id (`hidden` when reports hid it). On every
 * (re)subscription it reads the latest again, so nothing missed while
 * offline is lost. Returns a stop function.
 */
export function watchChat(
  supabase: Supabase,
  roomId: string,
  onMessages: (messages: ChatMessage[]) => void,
  onRemoved: (id: number, hidden: boolean) => void,
  onError: (error: unknown) => void,
): () => void {
  let stopped = false;
  const load = () => {
    supabase
      .from("room_messages")
      .select("id, user_id, nickname, body, created_at, hidden")
      .eq("room_id", roomId)
      .order("id", { ascending: false })
      .limit(CHAT_HISTORY)
      .then(({ data, error }) => {
        if (stopped) return;
        if (error) onError(error);
        else onMessages(data.flatMap((raw) => chatMessage(raw) ?? []).reverse());
      }, onError);
  };
  const channel = supabase
    .channel(`room-chat:${roomId}`, { config: { private: true } })
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` },
      ({ new: raw }) => {
        const message = chatMessage(raw);
        if (!stopped && message) onMessages([message]);
      },
    )
    .on("broadcast", { event: "removed" }, ({ payload }: { payload: unknown }) => {
      const parsed = z
        .object({ id: z.number(), hidden: z.optional(z.boolean()) })
        .safeParse(payload);
      if (parsed.success && !stopped) onRemoved(parsed.data.id, parsed.data.hidden === true);
    })
    .subscribe((status) => {
      const state: string = status;
      if (state === "SUBSCRIBED") load();
    });
  return () => {
    stopped = true;
    void supabase.removeChannel(channel);
  };
}
