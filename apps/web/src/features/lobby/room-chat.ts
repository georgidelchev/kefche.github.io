// A room's lobby chat (SPEC §8.2): the latest messages, then new ones as
// Realtime delivers them (RLS decides who receives them). Messages are
// written only through send_room_message, which masks and rate-limits.
import * as z from "zod/mini";

import type { Supabase } from "@/lib/supabase/client";

export interface ChatMessage {
  id: number;
  userId: string;
  nickname: string;
  body: string;
  at: number;
}

/** How many messages the chat shows (and loads when it opens). */
export const CHAT_HISTORY = 50;

const row = z.object({
  id: z.number(),
  user_id: z.string(),
  nickname: z.string(),
  body: z.string(),
  created_at: z.string(),
});

/** A message row from the database or Realtime, or null when malformed. */
export function chatMessage(raw: unknown): ChatMessage | null {
  const parsed = row.safeParse(raw);
  if (!parsed.success) return null;
  const { id, user_id, nickname, body, created_at } = parsed.data;
  return { id, userId: user_id, nickname, body, at: Date.parse(created_at) };
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
 * Calls `onMessages` with the latest messages, then with each new one. On
 * every (re)subscription it reads the latest again, so nothing missed while
 * offline is lost. Returns a stop function.
 */
export function watchChat(
  supabase: Supabase,
  roomId: string,
  onMessages: (messages: ChatMessage[]) => void,
  onError: (error: unknown) => void,
): () => void {
  let stopped = false;
  const load = () => {
    supabase
      .from("room_messages")
      .select("id, user_id, nickname, body, created_at")
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
    .channel(`room-chat:${roomId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` },
      ({ new: raw }) => {
        const message = chatMessage(raw);
        if (!stopped && message) onMessages([message]);
      },
    )
    .subscribe((status) => {
      const state: string = status;
      if (state === "SUBSCRIBED") load();
    });
  return () => {
    stopped = true;
    void supabase.removeChannel(channel);
  };
}
