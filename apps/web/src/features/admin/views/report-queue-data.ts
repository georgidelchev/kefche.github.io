// The moderation queue's data (Phase 10 step 4): open reports grouped by
// what was reported (staff_report_queue), the messages around a reported one
// (staff_report_context), and resolving (resolve_reports, then
// sanction_player for "remove and sanction").
// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import type { Supabase } from "@/lib/supabase/client";

import { sanctionArgs, type SanctionInput } from "./PlayerActions";

export const REPORT_TYPES = ["message", "room_message", "user", "avatar"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

/** The queue's type filter (`?type=`), or null for every type. */
export function typeFromUrl(search: string): ReportType | null {
  const type = z.enum(REPORT_TYPES).safeParse(new URLSearchParams(search).get("type"));
  return type.success ? type.data : null;
}

const text = z.nullable(z.string());
const QueueReport = z.object({
  id: z.string(),
  reporterId: text,
  reporter: text,
  reason: z.string(),
  details: text,
  at: z.string(),
});
const QueueItem = z.object({
  target_type: z.string(),
  target_id: z.string(),
  target_user_id: text,
  target_nickname: text,
  first_at: z.string(),
  last_at: z.string(),
  held: z.boolean(),
  /** The newest copy of what was reported (its fields depend on the type). */
  snapshot: z.record(z.string(), z.unknown()),
  /** Oldest first. */
  reports: z.array(QueueReport),
});
export type QueueItem = z.infer<typeof QueueItem>;

/** The open reports, grouped, longest waiting first; null on failure. */
export async function fetchQueue(
  supabase: Supabase,
  type: ReportType | null,
): Promise<QueueItem[] | null> {
  const { data, error } = await supabase.rpc("staff_report_queue", type ? { p_type: type } : {});
  if (error) return null;
  const items = z.array(QueueItem).safeParse(data);
  return items.success ? items.data : null;
}

/** An item's key: what was reported. */
export const itemKey = (item: QueueItem) => `${item.target_type}:${item.target_id}`;

const ContextMessage = z.object({
  id: z.number(),
  senderId: text,
  nickname: text,
  body: text,
  gifId: text,
  status: z.string(),
  at: z.string(),
});
export type ContextMessage = z.infer<typeof ContextMessage>;

/** Up to 5 messages before and 5 after the reported one, oldest first; null on failure. */
export async function fetchContext(
  supabase: Supabase,
  item: QueueItem,
): Promise<ContextMessage[] | null> {
  const { data, error } = await supabase.rpc("staff_report_context", {
    p_type: item.target_type,
    p_target: item.target_id,
  });
  if (error) return null;
  const messages = z.array(ContextMessage).safeParse(data);
  return messages.success ? messages.data : null;
}

/** Closes an item's reports: dismissed puts back what was hidden, actioned removes it. */
export async function resolveItem(
  supabase: Supabase,
  item: QueueItem,
  outcome: "dismissed" | "actioned",
): Promise<string | null> {
  const { error } = await supabase.rpc("resolve_reports", {
    p_type: item.target_type,
    p_target: item.target_id,
    p_outcome: outcome,
  });
  return error ? error.message : null;
}

/**
 * Removes the reported thing and sanctions its player, linked to the newest
 * report. The removal comes first: if the sanction is then refused (a staff
 * member's account, for a moderator), the removal stands and the error says why.
 */
export async function removeAndSanction(
  supabase: Supabase,
  item: QueueItem,
  sanction: SanctionInput,
): Promise<string | null> {
  const removed = await resolveItem(supabase, item, "actioned");
  if (removed !== null) return removed;
  if (item.target_user_id === null) return "user_not_found";
  const report = item.reports.at(-1)?.id;
  const { error } = await supabase.rpc(
    "sanction_player",
    sanctionArgs(item.target_user_id, sanction, report),
  );
  return error ? error.message : null;
}

/** How long the oldest report has waited: over a day is late, over 3 days very late. */
export function waitLevel(firstAt: string, now = Date.now()): "ok" | "late" | "veryLate" {
  const hours = (now - Date.parse(firstAt)) / 3_600_000;
  return hours > 72 ? "veryLate" : hours > 24 ? "late" : "ok";
}

/** "3 hours ago", in the page's language. */
export function ago(iso: string, bcp47: string, now = Date.now()): string {
  const minutes = Math.round((Date.parse(iso) - now) / 60_000);
  const format = new Intl.RelativeTimeFormat(bcp47, { numeric: "auto" });
  if (Math.abs(minutes) < 60) return format.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return format.format(hours, "hour");
  return format.format(Math.round(hours / 24), "day");
}
