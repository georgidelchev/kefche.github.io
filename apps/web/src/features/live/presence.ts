// Others' online status (SPEC §8.1): changes arrive on the player's own
// channel (live.client.ts), and presence_of reads them on load.
// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import { fill } from "@/features/games/turn/labels";
import type { Supabase } from "@/lib/supabase/client";
import { supabaseConfig } from "@/lib/supabase/config";

import { LIVE_EVENT } from "./presence-context";

export const statusSchema = z.object({
  status: z.enum(["online", "lobby", "playing", "away"]),
  game: z.nullable(z.string()),
});
export type Status = z.infer<typeof statusSchema>;

/** A friend's status changed: `status` "offline" when they left or hid it. */
export const presenceChangeSchema = z.object({
  user: z.string(),
  status: z.enum(["online", "lobby", "playing", "away", "offline"]),
  game: z.nullable(z.string()),
});

/** Calls `handler` with each friend's status change, until the returned function is called. */
export function onPresenceChange(
  handler: (user: string, status: Status | null) => void,
): () => void {
  const listener = (event: Event) => {
    const { detail } = event as CustomEvent<{ event?: unknown; payload?: unknown }>;
    if (detail.event !== "presence") return;
    const parsed = presenceChangeSchema.safeParse(detail.payload);
    if (!parsed.success) return;
    const { user, status, game } = parsed.data;
    handler(user, status === "offline" ? null : { status, game });
  };
  document.addEventListener(LIVE_EVENT, listener);
  return () => {
    document.removeEventListener(LIVE_EVENT, listener);
  };
}

/** presence_of's answer: the statuses the caller may see, by player id. */
export const statusesSchema = z.record(z.string(), statusSchema);

export interface PresenceStrings {
  online: string;
  /** "In a lobby: {game}" */
  lobby: string;
  /** "Playing {game}" */
  playing: string;
  away: string;
}

/** "Online", "Playing Chess", …; `names` maps game ids to names in the page's language. */
export function presenceText(
  status: Status,
  strings: PresenceStrings,
  names: Record<string, string>,
): string {
  if (status.status === "lobby" || status.status === "playing") {
    const game = status.game ? (names[status.game] ?? status.game) : "";
    return fill(strings[status.status], { game });
  }
  return strings[status.status];
}

/** The statuses of these players that the viewer may see (signed in or not), by id; empty on failure. */
export async function fetchStatuses(
  supabase: Supabase | null,
  ids: readonly string[],
): Promise<Record<string, Status>> {
  if (ids.length === 0) return {};
  const args = { p_users: [...ids] };
  let data: unknown = null;
  if (supabase) {
    const reply = await supabase.rpc("presence_of", args);
    data = reply.error ? null : reply.data;
  } else if (supabaseConfig) {
    const res = await fetch(new URL("/rest/v1/rpc/presence_of", supabaseConfig.url), {
      method: "POST",
      headers: { apikey: supabaseConfig.key, "content-type": "application/json" },
      body: JSON.stringify(args),
    }).catch(() => null);
    data = res?.ok ? await res.json().catch(() => null) : null;
  }
  const parsed = statusesSchema.safeParse(data);
  return parsed.success ? parsed.data : {};
}
