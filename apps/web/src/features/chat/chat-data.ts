// Global chat (SPEC §8.2): a room's history (`chat_history`), its new
// messages live, and sending. New messages arrive as Postgres changes,
// which Realtime checks against the read policy for each reader, so blocked
// players don't reach each other; deletions, and messages hidden by
// reports, arrive on the room's private channel. zod/mini: this module
// ships to the browser.
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
export type Sender = z.infer<typeof card>;

const messageSchema = z.object({
  id: z.number(),
  body: z.nullable(z.string()),
  gifId: z.optional(z.nullable(z.string())),
  status: z.string(),
  at: z.string(),
  sender: z.nullable(card),
});
export type ChatMessage = z.infer<typeof messageSchema>;

/** A page of history (and the size of one). */
export const PAGE = 50;
/** Kept in memory; older ones go (Show earlier brings them back). */
const KEPT = 500;

/** A room's messages older than `before`, oldest first; null when unreadable. */
export async function fetchHistory(
  supabase: Supabase,
  room: string,
  before: number | null,
): Promise<ChatMessage[] | null> {
  const { data, error } = await supabase.rpc("chat_history", {
    p_room: room,
    p_limit: PAGE,
    ...(before === null ? {} : { p_before: before }),
  });
  if (error) return null;
  const parsed = z.array(messageSchema).safeParse(data);
  return parsed.success ? parsed.data.toReversed() : null;
}

/** Sends a message (text, a GIF, or both): the stored message (masked), or the error. */
export async function sendMessage(
  supabase: Supabase,
  room: string,
  body: string,
  gif?: string,
): Promise<{ message: ChatMessage } | { error: unknown }> {
  const { data, error } = await supabase.rpc("send_chat_message", {
    p_room: room,
    p_body: body,
    ...(gif ? { p_gif: gif } : {}),
  });
  if (error) return { error };
  const parsed = messageSchema.safeParse(data);
  return parsed.success ? { message: parsed.data } : { error: new Error("invalid") };
}

/** Adds messages in id order without duplicates, keeping the latest KEPT. */
export function mergeMessages(
  current: readonly ChatMessage[],
  added: readonly ChatMessage[],
): ChatMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of added) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id).slice(-KEPT);
}

const rowSchema = z.object({
  id: z.number(),
  room: z.nullable(z.string()),
  sender_id: z.string(),
  body: z.nullable(z.string()),
  gif_id: z.nullable(z.string()),
  status: z.string(),
  created_at: z.string(),
});

/**
 * Watches a room: `onLoad` with the latest messages on every (re)subscription
 * (so nothing missed offline is lost), `onMessage` with each new one,
 * `onDeleted` with each deleted id, `onHidden` with each id reports hid
 * (and its sender). A new message's sender is read once and
 * remembered. Returns a stop function.
 */
export function watchRoom(
  supabase: Supabase,
  room: string,
  handlers: {
    onLoad: (messages: ChatMessage[]) => void;
    onMessage: (message: ChatMessage) => void;
    onDeleted: (id: number) => void;
    onHidden: (id: number, sender: string) => void;
    onError: () => void;
  },
): () => void {
  let stopped = false;
  const senders = new Map<string, Promise<Sender | null>>();
  const sender = (id: string) => {
    let known = senders.get(id);
    if (!known) {
      known = Promise.resolve(
        supabase
          .from("profiles")
          .select("id, nickname, avatar_kind, avatar_preset, avatar_path, avatar_frame")
          .eq("id", id)
          .maybeSingle(),
      ).then(({ data }) =>
        data?.nickname
          ? {
              id: data.id,
              nickname: data.nickname,
              avatarKind: data.avatar_kind,
              avatarPreset: data.avatar_preset,
              avatarPath: data.avatar_path,
              avatarFrame: data.avatar_frame,
            }
          : null,
      );
      senders.set(id, known);
    }
    return known;
  };
  const load = () => {
    void fetchHistory(supabase, room, null).then((messages) => {
      if (stopped) return;
      if (!messages) {
        handlers.onError();
        return;
      }
      for (const m of messages) if (m.sender) senders.set(m.sender.id, Promise.resolve(m.sender));
      handlers.onLoad(messages);
    });
  };
  const channel = supabase
    .channel(`chat:${room}`, { config: { private: true } })
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `room=eq.${room}` },
      ({ new: raw }) => {
        const row = rowSchema.safeParse(raw);
        if (!row.success || row.data.room !== room) return;
        const { id, sender_id, body, gif_id, status, created_at } = row.data;
        void sender(sender_id).then((card) => {
          if (!stopped) {
            handlers.onMessage({ id, body, gifId: gif_id, status, at: created_at, sender: card });
          }
        });
      },
    )
    .on("broadcast", { event: "deleted" }, ({ payload }: { payload: unknown }) => {
      const parsed = z.object({ id: z.number() }).safeParse(payload);
      if (parsed.success && !stopped) handlers.onDeleted(parsed.data.id);
    })
    .on("broadcast", { event: "hidden" }, ({ payload }: { payload: unknown }) => {
      const parsed = z.object({ id: z.number(), sender: z.string() }).safeParse(payload);
      if (parsed.success && !stopped) handlers.onHidden(parsed.data.id, parsed.data.sender);
    })
    .subscribe((status) => {
      const state: string = status;
      if (state === "SUBSCRIBED") load();
      if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") handlers.onError();
    });
  return () => {
    stopped = true;
    void supabase.removeChannel(channel);
  };
}
