// The admin panel's sections (SPEC §14). Moderators get the moderation
// sections; admins get them all. This list only decides what the menu offers:
// the database's policies and RPCs decide what each role may read or change.
import type { Database } from "@/lib/supabase/database.gen";

export type StaffRole = Database["public"]["Enums"]["app_role"];

const STAFF: readonly StaffRole[] = ["admin", "moderator"];
const ADMIN: readonly StaffRole[] = ["admin"];

export const ADMIN_SECTIONS = [
  { id: "dashboard", path: "/admin/", roles: STAFF },
  { id: "users", path: "/admin/users/", roles: STAFF },
  { id: "reports", path: "/admin/reports/", roles: STAFF },
  { id: "chat", path: "/admin/chat/", roles: STAFF },
  { id: "games", path: "/admin/games/", roles: ADMIN },
  { id: "integrity", path: "/admin/integrity/", roles: ADMIN },
  { id: "content", path: "/admin/content/", roles: ADMIN },
  { id: "i18n", path: "/admin/i18n/", roles: ADMIN },
  { id: "flags", path: "/admin/flags/", roles: ADMIN },
  { id: "audit", path: "/admin/audit/", roles: ADMIN },
] as const satisfies readonly { id: string; path: string; roles: readonly StaffRole[] }[];

export type AdminSectionId = (typeof ADMIN_SECTIONS)[number]["id"];

/** The sections with a page of their own under /admin/ (all but the dashboard). */
export type AdminSubsection = Exclude<AdminSectionId, "dashboard">;
export const ADMIN_SUBSECTIONS = ADMIN_SECTIONS.flatMap((section) =>
  section.id === "dashboard" ? [] : [section.id],
);

/** Literal keys (not built from the id) so typed `t()` and `pnpm i18n:check` can see them. */
export const ADMIN_LABEL_KEYS = {
  dashboard: "admin:sections.dashboard",
  users: "admin:sections.users",
  reports: "admin:sections.reports",
  chat: "admin:sections.chat",
  games: "admin:sections.games",
  integrity: "admin:sections.integrity",
  content: "admin:sections.content",
  i18n: "admin:sections.i18n",
  flags: "admin:sections.flags",
  audit: "admin:sections.audit",
} as const satisfies Record<AdminSectionId, `admin:${string}`>;

/** Whether someone with `roles` may open `section`. */
export function canOpen(section: AdminSectionId, roles: readonly StaffRole[]): boolean {
  const allowed: readonly StaffRole[] = ADMIN_SECTIONS.find((s) => s.id === section)?.roles ?? [];
  return roles.some((role) => allowed.includes(role));
}
