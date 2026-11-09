// One lazy chunk per admin section, loaded only once the panel knows its
// user is staff, so nobody else downloads admin code. The page passes the
// section with its strings (`AdminView`); a section without a view here
// isn't built yet. Import paths are literal so Vite can split them.
import { lazy, type ReactNode } from "react";

import type { Supabase } from "@/lib/supabase/client";

import type { AdminSectionId, StaffRole } from "./sections";
import type {
  AuditStrings,
  ChatStrings,
  GamesStrings,
  PlayersStrings,
  ReportsStrings,
} from "./strings";

/** Localized pages the views link to. */
export interface AdminPaths {
  /** "/<locale>/u/": a profile is `${profileBase}${nickname}/`. */
  profileBase: string;
  /** The audit log's page; filters go in its query string. */
  audit: string;
  /** The Players section's page; a player's page is `?player=<id>`. */
  users: string;
  /** The moderation queue's page; its type filter goes in the query string. */
  reports: string;
  /** The chat tools' page; a message search goes in the query string. */
  chat: string;
  /** The Games section's page; its room filter goes in the query string. */
  games: string;
  /** The arena server, or null when this build has none. */
  arena: string | null;
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
  | { section: "audit"; strings: AuditStrings }
  | { section: "users"; strings: PlayersStrings }
  | { section: "reports"; strings: ReportsStrings; players: PlayersStrings }
  | { section: "chat"; strings: ChatStrings; players: PlayersStrings }
  | { section: "games"; strings: GamesStrings; players: PlayersStrings }
  | { section: Exclude<AdminSectionId, "audit" | "users" | "reports" | "chat" | "games"> };

const AuditLog = lazy(() => import("./views/AuditLog").then((m) => ({ default: m.AuditLog })));
const Players = lazy(() => import("./views/Players").then((m) => ({ default: m.Players })));
const ReportQueue = lazy(() =>
  import("./views/ReportQueue").then((m) => ({ default: m.ReportQueue })),
);

const ChatTools = lazy(() => import("./views/ChatTools").then((m) => ({ default: m.ChatTools })));

const GamesAdmin = lazy(() =>
  import("./views/GamesAdmin").then((m) => ({ default: m.GamesAdmin })),
);

/** The section's view, or null when it isn't built yet. */
export function renderView(view: AdminView, props: AdminViewProps): ReactNode {
  if (view.section === "audit") return <AuditLog {...props} strings={view.strings} />;
  if (view.section === "users") return <Players {...props} strings={view.strings} />;
  if (view.section === "reports")
    return <ReportQueue {...props} strings={view.strings} players={view.players} />;
  if (view.section === "chat")
    return <ChatTools {...props} strings={view.strings} players={view.players} />;
  if (view.section === "games")
    return <GamesAdmin {...props} strings={view.strings} players={view.players} />;
  return null;
}
