// The admin panel's shell (SPEC §14): every /admin/ page is this island. It
// renders for everyone and fills only for staff: it reads its user's roles
// from the roles table (not the token, which can be an hour old), offers the
// sections those roles may open, and loads the current one's chunk. The
// database checks every read and change again, so the page decides nothing.
import {
  Flag,
  Gamepad2,
  Languages,
  LayoutDashboard,
  MessagesSquare,
  Newspaper,
  Scale,
  ScrollText,
  ShieldAlert,
  ToggleRight,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";

import { Button, buttonVariants } from "@kefche/ui/components/button";

import { useAccount } from "@/features/settings/use-account";
import type { Supabase } from "@/lib/supabase/client";

import { ADMIN_SECTIONS, canOpen, type AdminSectionId, type StaffRole } from "./sections";
import { renderView, type AdminPaths, type AdminView } from "./views";

import type { AdminStrings } from "./strings";

const ICONS: Record<AdminSectionId, LucideIcon> = {
  dashboard: LayoutDashboard,
  users: Users,
  reports: Flag,
  chat: MessagesSquare,
  games: Gamepad2,
  integrity: Scale,
  content: Newspaper,
  i18n: Languages,
  flags: ToggleRight,
  audit: ScrollText,
};

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

interface Props {
  /** The page's section, with its view's strings. */
  view: AdminView;
  strings: AdminStrings;
  bcp47: string;
  paths: AdminPaths;
  /** Each section's page, already localized. */
  links: Record<AdminSectionId, string>;
  signInPath: string;
  homePath: string;
}

/** The user's staff roles; null when they couldn't be read. */
async function fetchRoles(supabase: Supabase, userId: string): Promise<StaffRole[] | null> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return error ? null : data.map((row) => row.role);
}

export function AdminPanel({ view, strings: s, bcp47, paths, links, signInPath, homePath }: Props) {
  const { section } = view;
  const account = useAccount(signInPath);
  const [roles, setRoles] = useState<StaffRole[] | null | undefined>(undefined);

  useEffect(() => {
    if (account.status !== "ready") return;
    void fetchRoles(account.supabase, account.user.id).then(setRoles);
  }, [account]);
  const retry = () => {
    if (account.status !== "ready") return;
    setRoles(undefined);
    void fetchRoles(account.supabase, account.user.id).then(setRoles);
  };

  const title = <h1 className="text-3xl md:text-4xl">{s.sections[section]}</h1>;

  if (account.status === "error" || roles === null) {
    return (
      <div className="grid justify-items-start gap-3">
        {title}
        <p role="alert">{s.failed}</p>
        {account.status === "ready" && (
          <Button variant="outline" onClick={retry}>
            {s.retry}
          </Button>
        )}
      </div>
    );
  }
  if (account.status !== "ready" || roles === undefined) {
    return (
      <div className="grid gap-3">
        {title}
        <p className="min-h-32 text-muted" aria-busy="true">
          {s.loading}
        </p>
      </div>
    );
  }
  if (roles.length === 0) {
    return (
      <section className="mx-auto grid max-w-xl justify-items-center gap-4 py-12 text-center md:py-20">
        <div
          aria-hidden="true"
          className="flex size-16 items-center justify-center rounded-2xl bg-surface-2 text-brand-strong"
        >
          <ShieldAlert className="size-8" />
        </div>
        <h1 className="text-3xl md:text-4xl">{s.staffOnly}</h1>
        <p className="text-lg text-muted">{s.staffOnlyBody}</p>
        <a href={homePath} className={buttonVariants({ variant: "primary" })}>
          {s.home}
        </a>
      </section>
    );
  }

  const allowed = canOpen(section, roles);
  const content = renderView(view, {
    supabase: account.supabase,
    userId: account.user.id,
    roles,
    bcp47,
    paths,
  });
  return (
    <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start">
      <Menu section={section} roles={roles} strings={s} links={links} />
      <div className="grid min-w-0 content-start gap-6">
        {title}
        {!allowed ? (
          <p role="alert">{s.adminOnly}</p>
        ) : (
          <Suspense
            fallback={
              <p className="text-muted" aria-busy="true">
                {s.loading}
              </p>
            }
          >
            {content}
          </Suspense>
        )}
      </div>
    </div>
  );
}

/** Scrolls the bar (not the page) so that `link` shows. */
function showInBar(link: HTMLAnchorElement | null) {
  const bar = link?.closest("ul");
  if (!link || !bar || bar.scrollWidth <= bar.clientWidth) return;
  const { left, right } = link.getBoundingClientRect();
  const box = bar.getBoundingClientRect();
  if (left < box.left) bar.scrollLeft -= box.left - left;
  else if (right > box.right) bar.scrollLeft += right - box.right;
}

/** A side menu from 1024px; above the section, scrolling sideways, below that. */
function Menu({
  section,
  roles,
  strings: s,
  links,
}: {
  section: AdminSectionId;
  roles: readonly StaffRole[];
  strings: AdminStrings;
  links: Record<AdminSectionId, string>;
}) {
  const items = ADMIN_SECTIONS.filter(({ id }) => canOpen(id, roles));
  return (
    <nav
      aria-label={s.menu}
      className="-m-1 grid min-w-0 gap-2 lg:sticky lg:top-[calc(5.5rem+env(safe-area-inset-top))] lg:m-0"
    >
      <p className="hidden px-3 text-sm font-semibold text-muted lg:block">
        {roles.includes("admin") ? s.role.admin : s.role.moderator}
      </p>
      {/* The padding keeps focus rings inside the scrolling bar. */}
      <ul className="flex gap-1 overflow-x-auto p-1 lg:grid lg:overflow-visible lg:p-0">
        {items.map(({ id }) => {
          const Icon = ICONS[id];
          return (
            <li key={id} className="shrink-0">
              <a
                href={links[id]}
                aria-current={id === section ? "page" : undefined}
                // In the bar on top, the current section starts in view.
                ref={id === section ? showInBar : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-xl px-3 font-semibold whitespace-nowrap text-muted hover:bg-surface-2 hover:text-text aria-[current=page]:bg-surface-2 aria-[current=page]:text-text lg:gap-3 ${focusRing}`}
              >
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                {s.sections[id]}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
