// The Players section's data (Phase 10 step 3). Finding players and reading
// one player's account go through staff-only RPCs (staff_find_players,
// staff_player), since emails, guests and matches set aside for review are
// closed to RLS; sanctions and reports are read through their own policies,
// which admit staff. The search lives in the URL, so a search can be linked
// to and the back button returns to it.
// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import type { Supabase } from "@/lib/supabase/client";

export const PLAYERS_PAGE = 50;

export const ROLE_FILTERS = ["staff", "admin", "moderator", "none"] as const;
export const SANCTION_FILTERS = ["any", "mute", "suspend", "ban"] as const;
export const ACCOUNT_FILTERS = ["account", "guest"] as const;

/** Each parameter on its own, so one bad one doesn't drop the others. */
const FIELDS = {
  q: z.string().check(z.minLength(1), z.maxLength(100)),
  role: z.enum(ROLE_FILTERS),
  sanction: z.enum(SANCTION_FILTERS),
  account: z.enum(ACCOUNT_FILTERS),
};
export interface PlayerSearch {
  q?: string;
  role?: (typeof ROLE_FILTERS)[number];
  sanction?: (typeof SANCTION_FILTERS)[number];
  account?: (typeof ACCOUNT_FILTERS)[number];
}

export function searchFromUrl(search: string): PlayerSearch {
  const params = new URLSearchParams(search);
  const out: PlayerSearch = {};
  const q = FIELDS.q.safeParse(params.get("q")?.trim());
  if (q.success) out.q = q.data;
  const role = FIELDS.role.safeParse(params.get("role"));
  if (role.success) out.role = role.data;
  const sanction = FIELDS.sanction.safeParse(params.get("sanction"));
  if (sanction.success) out.sanction = sanction.data;
  const account = FIELDS.account.safeParse(params.get("account"));
  if (account.success) out.account = account.data;
  return out;
}

/** The player whose page is open (`?player=<id>`), or null for the search. */
export function playerFromUrl(search: string): string | null {
  const id = z.uuid().safeParse(new URLSearchParams(search).get("player"));
  return id.success ? id.data.toLowerCase() : null;
}

const text = z.nullable(z.string());
const PlayerRow = z.object({
  id: z.string(),
  nickname: text,
  guest: z.boolean(),
  avatar_kind: z.string(),
  avatar_preset: text,
  avatar_path: text,
  created_at: z.string(),
  roles: z.array(z.string()),
  sanction: text,
  email: text,
});
export type PlayerRow = z.infer<typeof PlayerRow>;

/** A page of players from `offset`, or null on failure. */
export async function findPlayers(
  supabase: Supabase,
  search: PlayerSearch,
  offset: number,
): Promise<{ players: PlayerRow[]; more: boolean } | null> {
  const { data, error } = await supabase.rpc("staff_find_players", {
    ...(search.q && { p_query: search.q }),
    ...(search.role && { p_role: search.role }),
    ...(search.sanction && { p_sanction: search.sanction }),
    ...(search.account && { p_account: search.account }),
    p_offset: offset,
  });
  if (error) return null;
  const rows = z.array(PlayerRow).safeParse(data);
  if (!rows.success) return null;
  return { players: rows.data.slice(0, PLAYERS_PAGE), more: rows.data.length > PLAYERS_PAGE };
}

const Match = z.object({
  id: z.string(),
  gameId: z.string(),
  rated: z.boolean(),
  status: z.string(),
  reason: z.string(),
  /** Null for a game played alone. */
  outcome: z.nullable(z.number()),
  endedAt: z.string(),
  /** The other players' nicknames ("" for one without). */
  others: z.array(z.string()),
});
export type PlayerMatch = z.infer<typeof Match>;

const Player = z.object({
  id: z.string(),
  nickname: text,
  guest: z.boolean(),
  avatarKind: z.string(),
  avatarPreset: text,
  avatarPath: text,
  country: text,
  bio: text,
  level: z.number(),
  xp: z.number(),
  createdAt: z.string(),
  nicknameChangedAt: text,
  lastSignInAt: text,
  /** Admins only. */
  email: text,
  roles: z.array(z.string()),
  deletionAt: text,
  sanction: text,
  matches: z.array(Match),
});
export type Player = z.infer<typeof Player>;

export interface Sanction {
  id: string;
  kind: string;
  reason: string;
  note: string | null;
  createdBy: string | null;
  startsAt: string;
  endsAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
}

export interface Report {
  id: string;
  reporterId: string | null;
  targetUserId: string | null;
  targetType: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
}

export interface PlayerPage {
  player: Player;
  sanctions: Sanction[];
  reportsAbout: Report[];
  reportsBy: Report[];
  /** Nicknames of the staff and players these mention. */
  names: Map<string, string>;
}

const REPORT_COLUMNS =
  "id, reporter_id, target_user_id, target_type, reason, details, status, created_at";
interface ReportRow {
  id: string;
  reporter_id: string | null;
  target_user_id: string | null;
  target_type: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
}
const toReport = (r: ReportRow): Report => ({
  id: r.id,
  reporterId: r.reporter_id,
  targetUserId: r.target_user_id,
  targetType: r.target_type,
  reason: r.reason,
  details: r.details,
  status: r.status,
  createdAt: r.created_at,
});

/** In force now: not revoked, started, and not yet over (a warning never is). */
export const inForce = (s: Sanction, now = Date.now()) =>
  s.kind !== "warn" &&
  s.revokedAt === null &&
  Date.parse(s.startsAt) <= now &&
  (s.endsAt === null || Date.parse(s.endsAt) > now);

/** One player's page: undefined when there's no such account, null on failure. */
export async function fetchPlayerPage(
  supabase: Supabase,
  id: string,
): Promise<PlayerPage | undefined | null> {
  const [player, sanctions, about, by] = await Promise.all([
    supabase.rpc("staff_player", { p_user: id }),
    supabase
      .from("sanctions")
      .select("id, kind, reason, note, created_by, starts_at, ends_at, revoked_at, revoked_by")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("reports")
      .select(REPORT_COLUMNS)
      .eq("target_user_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("reports")
      .select(REPORT_COLUMNS)
      .eq("reporter_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (player.error || sanctions.error || about.error || by.error) return null;
  if (player.data === null) return undefined;
  const parsed = Player.safeParse(player.data);
  if (!parsed.success) return null;

  const page: PlayerPage = {
    player: parsed.data,
    sanctions: sanctions.data.map((s) => ({
      id: s.id,
      kind: s.kind,
      reason: s.reason,
      note: s.note,
      createdBy: s.created_by,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      revokedAt: s.revoked_at,
      revokedBy: s.revoked_by,
    })),
    reportsAbout: about.data.map(toReport),
    reportsBy: by.data.map(toReport),
    names: new Map(),
  };
  const ids = [
    ...page.sanctions.flatMap((s) => [s.createdBy, s.revokedBy]),
    ...page.reportsAbout.map((r) => r.reporterId),
    ...page.reportsBy.map((r) => r.targetUserId),
  ].filter((v): v is string => v !== null);
  const unique = [...new Set(ids)];
  if (unique.length > 0) {
    const { data } = await supabase.from("profiles").select("id, nickname").in("id", unique);
    for (const p of data ?? []) if (p.nickname) page.names.set(p.id, p.nickname);
  }
  return page;
}
