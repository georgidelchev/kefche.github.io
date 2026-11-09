// The dashboard (SPEC §14, Phase 10 step 11), for staff: active players
// (Q5), what's happening now, sign-ups, matches per game; for admins, usage
// against the free plans (Q1) with links to the providers' dashboards.
// Read-only.
import { useEffect, useState, type ReactNode } from "react";

import { fill } from "@/features/auth/strings";
import { supabaseConfig } from "@/lib/supabase/config";

import {
  bytesText,
  fetchDashboard,
  fetchUsage,
  FREE_PLAN,
  supabaseDashboard,
  type Dashboard,
  type Usage,
} from "./dashboard-data";
import { fetchArenas, type ArenaStatus } from "./games-data";
import { ago } from "./report-queue-data";
import { linkClass } from "./ui";

import type { DashboardStrings, PlayersStrings } from "../strings";
import type { AdminViewProps } from "../views";

type Props = AdminViewProps & { strings: DashboardStrings; players: PlayersStrings };

function Tile({ label, value, note }: { label: string; value: string; note?: ReactNode }) {
  return (
    <div className="grid content-start gap-1 rounded-2xl border border-border bg-surface p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-3xl font-semibold tabular-nums">{value}</dd>
      {note !== undefined && <dd className="text-sm text-muted">{note}</dd>}
    </div>
  );
}

function Part({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <h2 id={id} className="text-xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function DashboardView({ supabase, roles, bcp47, paths, strings: s, players }: Props) {
  const admin = roles.includes("admin");
  const [data, setData] = useState<Dashboard | null | "failed">(null);
  const [usage, setUsage] = useState<Usage | null | "failed">(null);
  const [arenas, setArenas] = useState<ArenaStatus | null>(null);
  const number = (n: number) => n.toLocaleString(bcp47);
  const day = (iso: string) =>
    new Intl.DateTimeFormat(bcp47, { month: "short", day: "numeric", timeZone: "UTC" }).format(
      new Date(`${iso}T00:00:00Z`),
    );

  useEffect(() => {
    void fetchDashboard(supabase).then((next) => {
      setData(next ?? "failed");
    });
    if (admin)
      void fetchUsage(supabase).then((next) => {
        setUsage(next ?? "failed");
      });
    void fetchArenas(paths.arena).then(setArenas);
  }, [supabase, admin, paths.arena]);

  if (data === null)
    return (
      <p className="text-muted" aria-busy="true">
        {s.loading}
      </p>
    );
  if (data === "failed") return <p role="alert">{s.failed}</p>;

  const peak = Math.max(1, ...data.days.map((d) => d.active));
  const arenaPeople = arenas ? Object.values(arenas).reduce((sum, a) => sum + a.people, 0) : null;
  const topMatches = Math.max(1, ...data.matches.map((m) => m.count));

  return (
    <div className="grid gap-10">
      <Part id="dash-now" title={s.nowTitle}>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label={s.online} value={number(data.online)} note={s.onlineNote} />
          <Tile label={s.rooms} value={number(data.rooms)} />
          {arenaPeople !== null && <Tile label={s.arenas} value={number(arenaPeople)} />}
          <Tile
            label={s.reports}
            value={number(data.reports)}
            note={
              <>
                {data.oldestReport && (
                  <span className="block">
                    {fill(s.oldest, { ago: ago(data.oldestReport, bcp47) })}
                  </span>
                )}
                <a href={paths.reports} className={linkClass}>
                  {s.openQueue}
                </a>
              </>
            }
          />
        </dl>
      </Part>

      <Part id="dash-active" title={s.activeTitle}>
        <p className="max-w-prose text-sm text-muted">{s.activeNote}</p>
        <dl className="grid grid-cols-3 gap-3">
          <Tile label={s.dau} value={number(data.dau)} />
          <Tile label={s.wau} value={number(data.wau)} />
          <Tile label={s.mau} value={number(data.mau)} />
        </dl>
        <figure className="grid gap-2 rounded-2xl border border-border bg-surface p-4">
          <figcaption className="text-sm font-semibold">{s.chartTitle}</figcaption>
          {/* One series: its title names it, so no legend. Each bar shows its day and value on hover or focus; the table below has them all. */}
          <div className="flex h-40 items-end gap-0.5" aria-hidden="true">
            {data.days.map((d) => (
              <div key={d.day} className="group relative flex h-full flex-1 items-end">
                <div
                  className="w-full rounded-t bg-brand"
                  style={{ height: `${String(Math.max(2, (d.active / peak) * 100))}%` }}
                />
                <span className="pointer-events-none absolute start-1/2 bottom-full z-10 mb-1 hidden -translate-x-1/2 rounded-lg bg-text px-2 py-1 text-xs whitespace-nowrap text-bg group-hover:block rtl:translate-x-1/2">
                  {day(d.day)}: {number(d.active)}
                </span>
              </div>
            ))}
          </div>
          <details>
            <summary className="cursor-pointer text-sm">{s.asTable}</summary>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr>
                  <th scope="col" className="text-start font-semibold">
                    {s.dayCol}
                  </th>
                  <th scope="col" className="text-end font-semibold">
                    {s.activeCol}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((d) => (
                  <tr key={d.day}>
                    <td>{day(d.day)}</td>
                    <td className="text-end tabular-nums">{number(d.active)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </figure>
      </Part>

      <Part id="dash-signups" title={s.signupsTitle}>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label={s.signupsDay} value={number(data.signups.day)} />
          <Tile label={s.signupsWeek} value={number(data.signups.week)} />
          <Tile label={s.signupsMonth} value={number(data.signups.month)} />
          <Tile label={s.guestsWeek} value={number(data.signups.guestsWeek)} />
        </dl>
      </Part>

      <Part id="dash-matches" title={s.matchesTitle}>
        {data.matches.length === 0 ? (
          <p className="text-muted">{s.noMatches}</p>
        ) : (
          <ul className="grid gap-2 rounded-2xl border border-border bg-surface p-4">
            {data.matches.map((m) => (
              <li
                key={m.gameId}
                className="grid grid-cols-[minmax(6rem,10rem)_1fr_auto] items-center gap-3"
              >
                <span className="truncate">{players.games[m.gameId] ?? m.gameId}</span>
                <span aria-hidden="true" className="h-3">
                  <span
                    className="block h-full rounded-e bg-brand"
                    style={{ width: `${String(Math.max(1, (m.count / topMatches) * 100))}%` }}
                  />
                </span>
                <span className="text-end font-semibold tabular-nums">{number(m.count)}</span>
              </li>
            ))}
          </ul>
        )}
      </Part>

      {admin && (
        <Part id="dash-usage" title={s.usageTitle}>
          <p className="max-w-prose text-sm text-muted">{s.usageBody}</p>
          {usage === null && (
            <p className="text-muted" aria-busy="true">
              {s.loading}
            </p>
          )}
          {usage === "failed" && <p role="alert">{s.failed}</p>}
          {usage !== null && usage !== "failed" && (
            <>
              <dl className="grid gap-3 md:grid-cols-3">
                <Tile
                  label={s.database}
                  value={bytesText(usage.databaseBytes, bcp47)}
                  note={fill(s.ofLimit, { limit: bytesText(FREE_PLAN.databaseBytes, bcp47) })}
                />
                <Tile
                  label={s.storage}
                  value={bytesText(usage.storageBytes, bcp47)}
                  note={`${fill(s.ofLimit, { limit: bytesText(FREE_PLAN.storageBytes, bcp47) })} · ${fill(s.files, { count: number(usage.storageFiles) })}`}
                />
                <Tile
                  label={s.accounts}
                  value={number(usage.accounts)}
                  note={fill(s.guests, { count: number(usage.guests) })}
                />
              </dl>
              <div className="grid gap-2">
                <h3 className="text-base">{s.largest}</h3>
                <ul className="grid gap-1 text-sm">
                  {usage.tables.map((table) => (
                    <li key={table.name} className="flex flex-wrap gap-x-3">
                      <code className="min-w-0 break-all">{table.name}</code>
                      <span className="tabular-nums">{bytesText(table.bytes, bcp47)}</span>
                      <span className="text-muted tabular-nums">
                        {fill(s.rows, { count: number(table.rows) })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="flex flex-wrap gap-x-6 gap-y-2">
                <a
                  href={supabaseDashboard(supabaseConfig?.url)}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClass}
                >
                  {s.supabaseLink}
                </a>
                <a
                  href="https://dash.cloudflare.com/"
                  target="_blank"
                  rel="noreferrer"
                  className={linkClass}
                >
                  {s.cloudflareLink}
                </a>
              </p>
              <p className="text-sm text-muted">{s.errorsNote}</p>
            </>
          )}
        </Part>
      )}
    </div>
  );
}
