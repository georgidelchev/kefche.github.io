// The player's notifications (SPEC §8.4): `my_notifications` and
// `read_notifications`, validated. The database stores what a notification is
// about; how it reads is notification-text.ts's. zod/mini: this module ships
// to the browser.
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

export const notificationSchema = z.object({
  id: z.number(),
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
  at: z.string(),
  // Live ones (from the player's channel) arrive unread, without the field.
  read: z.optional(z.boolean()),
  from: z.nullable(card),
  // A sanction's note from the moderator, shown as written (the list has it; live ones don't).
  note: z.optional(z.nullable(z.string())),
});
export type Notification = z.infer<typeof notificationSchema>;

const pageSchema = z.object({ items: z.array(notificationSchema), unread: z.int() });

/** A page of notifications older than `before` (an id), or null when unreadable. */
export async function fetchNotifications(
  supabase: Supabase,
  before: number | null,
): Promise<z.infer<typeof pageSchema> | null> {
  const { data, error } = await supabase.rpc("my_notifications", {
    ...(before === null ? {} : { p_before: before }),
  });
  if (error) return null;
  const parsed = pageSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** Marks these notifications read (all of them without ids); the unread count left, or null. */
export async function readNotifications(
  supabase: Supabase,
  ids?: number[],
): Promise<number | null> {
  const { data, error } = await supabase.rpc("read_notifications", ids ? { p_ids: ids } : {});
  return error || typeof data !== "number" ? null : data;
}
