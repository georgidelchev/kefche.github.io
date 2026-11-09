// One lazy chunk per admin section, loaded only once the panel knows its
// user is staff, so nobody else downloads admin code. The page passes the
// section with its strings (`AdminView`); a section without a view here
// isn't built yet. Import paths are literal so Vite can split them.
import { lazy, type ReactNode } from "react";

import type { Supabase } from "@/lib/supabase/client";

import type { AdminSectionId, StaffRole } from "./sections";
import type { AuditStrings } from "./strings";

/** Localized pages the views link to. */
export interface AdminPaths {
  /** "/<locale>/u/": a profile is `${profileBase}${nickname}/`. */
  profileBase: string;
  /** The audit log's page; filters go in its query string. */
  audit: string;
}

/** What every view gets. */
export interface AdminViewProps {
  supabase: Supabase;
  /** The staff member using the panel. */
  userId: string;
  roles: readonly StaffRole[];
  bcp47: string;
  paths: AdminPaths;
}

/** The page's section, with the strings its view needs. */
export type AdminView =
  { section: "audit"; strings: AuditStrings } | { section: Exclude<AdminSectionId, "audit"> };

const AuditLog = lazy(() => import("./views/AuditLog").then((m) => ({ default: m.AuditLog })));

/** The section's view, or null when it isn't built yet. */
export function renderView(view: AdminView, props: AdminViewProps): ReactNode {
  if (view.section === "audit") return <AuditLog {...props} strings={view.strings} />;
  return null;
}
