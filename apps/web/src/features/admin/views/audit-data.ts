// The audit log's data (Phase 10 step 2): the filters, kept in the URL so a
// filtered view can be linked to, and the entries, newest first. Reads go
// straight to `audit_log`, whose policy lets admins alone read it.
// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import type { Supabase } from "@/lib/supabase/client";

export const AUDIT_PAGE = 50;

const isUuid = (text: string) => z.uuid().safeParse(text).success;
const day = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/));

/** Each filter on its own, so one bad parameter doesn't drop the others. */
const FIELDS = {
  /** A nickname or an account id, as typed. */
  actor: z.string().check(z.minLength(1), z.maxLength(64)),
  action: z.string().check(z.regex(/^[a-z][a-z0-9_.]{1,63}$/)),
  type: z.string().check(z.regex(/^[a-z][a-z0-9_]{1,31}$/)),
  /** An id, or a nickname when the type is a player's. */
  target: z.string().check(z.minLength(1), z.maxLength(128)),
  from: day,
  to: day,
};
export type AuditFilter = Partial<Record<keyof typeof FIELDS, string>>;
const KEYS = Object.keys(FIELDS) as (keyof typeof FIELDS)[];

export function filterFromSearch(search: string): AuditFilter {
  const params = new URLSearchParams(search);
  const filter: AuditFilter = {};
  for (const key of KEYS) {
    const value = params.get(key)?.trim();
    if (value && FIELDS[key].safeParse(value).success) filter[key] = value;
  }
  return filter;
}

export function searchFromFilter(filter: AuditFilter): string {
  const params = new URLSearchParams();
  for (const key of KEYS) {
    const value = filter[key];
    if (value) params.set(key, value);
  }
  const search = params.toString();
  return search === "" ? "" : `?${search}`;
}

/** Target types whose id is an account's: their filter takes a nickname too. */
export const PLAYER_TARGETS: readonly string[] = ["user", "avatar"];

export interface AuditEntry {
  id: number;
  actorId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

/** An account id for a nickname or an id: undefined when nobody has it, null on failure. */
export async function resolvePlayer(
  supabase: Supabase,
  text: string,
): Promise<string | undefined | null> {
  if (isUuid(text)) return text;
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("nickname", text)
    .maybeSingle();
  return error ? null : (data?.id ?? undefined);
}

/** Filters with nicknames turned into ids; `unknown` names the one nobody has. */
export type ResolvedFilter =
  | { status: "ok"; actorId?: string; targetId?: string; filter: AuditFilter }
  | { status: "unknown"; field: "actor" | "target" }
  | { status: "failed" };

export async function resolveFilter(
  supabase: Supabase,
  filter: AuditFilter,
): Promise<ResolvedFilter> {
  const resolved: ResolvedFilter = { status: "ok", filter };
  if (filter.actor) {
    const id = await resolvePlayer(supabase, filter.actor);
    if (id === null) return { status: "failed" };
    if (id === undefined) return { status: "unknown", field: "actor" };
    resolved.actorId = id;
  }
  if (filter.target) {
    if (filter.type && PLAYER_TARGETS.includes(filter.type)) {
      const id = await resolvePlayer(supabase, filter.target);
      if (id === null) return { status: "failed" };
      if (id === undefined) return { status: "unknown", field: "target" };
      resolved.targetId = id;
    } else {
      resolved.targetId = filter.target;
    }
  }
  return resolved;
}

/** Local midnight of `date` (YYYY-MM-DD), `days` later, as an ISO time. */
function localMidnight(date: string, days = 0): string {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return new Date(y, m - 1, d + days).toISOString();
}

/** A page of entries older than `before` (none: the newest), or null on failure. */
export async function fetchAudit(
  supabase: Supabase,
  resolved: Extract<ResolvedFilter, { status: "ok" }>,
  before: number | null,
): Promise<{ entries: AuditEntry[]; more: boolean } | null> {
  const { filter, actorId, targetId } = resolved;
  let query = supabase
    .from("audit_log")
    .select("id, actor_id, action, target_type, target_id, details, created_at")
    .order("id", { ascending: false })
    .limit(AUDIT_PAGE + 1);
  if (before !== null) query = query.lt("id", before);
  if (actorId) query = query.eq("actor_id", actorId);
  if (filter.action) query = query.eq("action", filter.action);
  if (filter.type) query = query.eq("target_type", filter.type);
  if (targetId) query = query.eq("target_id", targetId);
  if (filter.from) query = query.gte("created_at", localMidnight(filter.from));
  if (filter.to) query = query.lt("created_at", localMidnight(filter.to, 1));
  const { data, error } = await query;
  if (error) return null;
  const entries = data.slice(0, AUDIT_PAGE).map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    details: typeof row.details === "object" && !Array.isArray(row.details) ? row.details : {},
    createdAt: row.created_at,
  }));
  return { entries, more: data.length > AUDIT_PAGE };
}

/** Every account id an entry mentions: its actor, a player target, and ids in its details. */
export function mentionedIds(entry: AuditEntry): string[] {
  const ids: string[] = [];
  if (entry.actorId) ids.push(entry.actorId);
  if (entry.targetId && entry.targetType && PLAYER_TARGETS.includes(entry.targetType))
    ids.push(entry.targetId);
  for (const value of Object.values(entry.details))
    if (typeof value === "string" && isUuid(value)) ids.push(value);
  return ids;
}

/**
 * Nicknames by account id. An id missing from the map has no profile anyone
 * can read: a deleted account, one that never chose a nickname, or not an
 * account at all.
 */
export async function fetchNicknames(
  supabase: Supabase,
  ids: readonly string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select("id, nickname").in("id", unique);
  return new Map((data ?? []).flatMap((p) => (p.nickname ? [[p.id, p.nickname] as const] : [])));
}
