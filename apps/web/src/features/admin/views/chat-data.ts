// The chat tools' data (Phase 10 step 5): searching global and lobby chat
// (staff_search_messages; DMs aren't searchable, Q4), the global rooms'
// slow mode (chat_rooms, set_slow_mode), the players muted now
// (staff_muted_players), and deleting or revoking through the audited RPCs.
// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import { LOCALES, type Locale } from "@/i18n/locales";
import type { Supabase } from "@/lib/supabase/client";

export const SCOPES = ["global", "lobby"] as const;
export type Scope = (typeof SCOPES)[number];

/** Slow mode choices, in seconds (0 is off); the database allows 0 to 600. */
export const SLOW_MODE_STEPS = [0, 5, 10, 30, 60, 120, 300, 600] as const;

export interface MessageSearch {
  scope: Scope;
  /** A global room, or null for all of them (global only). */
  room: Locale | null;
  query: string;
  sender: string;
}

const short = z.string().check(z.maxLength(100));

/** The search in the URL (`?scope=&room=&q=&sender=`); a bad parameter is ignored. */
export function searchFromUrl(search: string): MessageSearch {
  const params = new URLSearchParams(search);
  const scope = z.enum(SCOPES).safeParse(params.get("scope"));
  const room = z.enum(LOCALES).safeParse(params.get("room"));
  const query = short.safeParse(params.get("q")?.trim());
  const sender = short.safeParse(params.get("sender")?.trim());
  const global = !scope.success || scope.data === "global";
  return {
    scope: global ? "global" : "lobby",
    room: global && room.success ? room.data : null,
    query: query.success ? query.data : "",
    sender: sender.success ? sender.data : "",
  };
}

const text = z.nullable(z.string());
const FoundMessage = z.object({
  kind: z.enum(["message", "room_message"]),
  id: z.number(),
  room: text,
  lobby_id: text,
  lobby_code: text,
  lobby_game: text,
  sender_id: z.string(),
  nickname: text,
  body: text,
  gif_id: text,
  status: z.string(),
  created_at: z.string(),
});
export type FoundMessage = z.infer<typeof FoundMessage>;

export const PAGE = 50;

/** One page of matches, newest first, older than `before`; null on failure. */
export async function searchMessages(
  supabase: Supabase,
  search: MessageSearch,
  before: number | null,
): Promise<{ messages: FoundMessage[]; more: boolean } | null> {
  const { data, error } = await supabase.rpc("staff_search_messages", {
    p_scope: search.scope,
    ...(search.room ? { p_room: search.room } : {}),
    ...(search.query ? { p_query: search.query } : {}),
    ...(search.sender ? { p_sender: search.sender } : {}),
    ...(before === null ? {} : { p_before: before }),
  });
  if (error) return null;
  const rows = z.array(FoundMessage).safeParse(data);
  if (!rows.success) return null;
  return { messages: rows.data.slice(0, PAGE), more: rows.data.length > PAGE };
}

/** Deletes a message (audited); null when done, else the error code. */
export async function deleteMessage(
  supabase: Supabase,
  message: FoundMessage,
): Promise<string | null> {
  const { error } =
    message.kind === "message"
      ? await supabase.rpc("delete_chat_message", { p_message: message.id })
      : await supabase.rpc("delete_room_message", { p_message: message.id });
  return error ? error.message : null;
}

const Room = z.object({ locale: z.enum(LOCALES), slow_mode_seconds: z.number() });
export type Room = z.infer<typeof Room>;

/** Every global room with its slow mode, in the site's locale order; null on failure. */
export async function fetchRooms(supabase: Supabase): Promise<Room[] | null> {
  const { data, error } = await supabase.from("chat_rooms").select("locale, slow_mode_seconds");
  if (error) return null;
  const rooms = z.array(Room).safeParse(data);
  if (!rooms.success) return null;
  return [...rooms.data].sort((a, b) => LOCALES.indexOf(a.locale) - LOCALES.indexOf(b.locale));
}

/** Sets a room's slow mode (audited); null when done, else the error code. */
export async function setSlowMode(
  supabase: Supabase,
  room: Locale,
  seconds: number,
): Promise<string | null> {
  const { error } = await supabase.rpc("set_slow_mode", { p_room: room, p_seconds: seconds });
  return error ? error.message : null;
}

const Mute = z.object({
  sanction_id: z.string(),
  user_id: z.string(),
  nickname: text,
  reason: z.string(),
  note: text,
  starts_at: z.string(),
  ends_at: text,
  created_by: text,
  created_by_nickname: text,
});
export type Mute = z.infer<typeof Mute>;

/** The mutes in force, ending soonest first; null on failure. */
export async function fetchMutes(supabase: Supabase): Promise<Mute[] | null> {
  const { data, error } = await supabase.rpc("staff_muted_players");
  if (error) return null;
  const mutes = z.array(Mute).safeParse(data);
  return mutes.success ? mutes.data : null;
}

/** Revokes a mute (audited); null when done, else the error code. */
export async function revokeMute(supabase: Supabase, mute: Mute): Promise<string | null> {
  const { error } = await supabase.rpc("revoke_sanction", { p_sanction: mute.sanction_id });
  return error ? error.message : null;
}

/** "Off", "30 seconds", "2 minutes", in the page's language. */
export function slowModeLabel(seconds: number, off: string, bcp47: string): string {
  if (seconds === 0) return off;
  const minutes = seconds >= 60 && seconds % 60 === 0;
  return new Intl.NumberFormat(bcp47, {
    style: "unit",
    unit: minutes ? "minute" : "second",
    unitDisplay: "long",
  }).format(minutes ? seconds / 60 : seconds);
}
