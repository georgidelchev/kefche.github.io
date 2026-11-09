// The audit log (SPEC §14, Phase 10 step 2): read-only, newest first,
// filtered by who, what, what about and when. The filters live in the URL:
// the form submits to this page, and each entry's actor and target link to
// the log filtered by them, so the back button works as usual.
import { ScrollText } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";

import { Button, buttonVariants } from "@kefche/ui/components/button";
import { Input } from "@kefche/ui/components/input";
import { EmptyState } from "@kefche/ui/components/states";

import { fill } from "@/features/auth/strings";
import type { Supabase } from "@/lib/supabase/client";

import {
  fetchAudit,
  fetchNicknames,
  filterFromSearch,
  mentionedIds,
  PLAYER_TARGETS,
  resolveFilter,
  searchFromFilter,
  type AuditEntry,
  type AuditFilter,
  type ResolvedFilter,
} from "./audit-data";

import type { AuditStrings } from "../strings";
import type { AdminViewProps } from "../views";

type Names = Map<string, string>;
type State =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "unknown"; field: "actor" | "target" }
  | {
      status: "ready";
      resolved: Extract<ResolvedFilter, { status: "ok" }>;
      entries: AuditEntry[];
      more: boolean;
      names: Names;
    };

const selectClass =
  "min-h-11 w-full min-w-0 cursor-pointer rounded-xl border border-border-strong bg-surface-2 px-3 text-base text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const linkClass =
  "rounded font-semibold text-text underline decoration-border-strong underline-offset-4 hover:decoration-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** The newest entries for `filter`, with the names they mention. */
async function firstPage(supabase: Supabase, filter: AuditFilter): Promise<State> {
  const resolved = await resolveFilter(supabase, filter);
  if (resolved.status !== "ok") return resolved;
  const page = await fetchAudit(supabase, resolved, null);
  if (!page) return { status: "failed" };
  const names = await fetchNicknames(supabase, page.entries.flatMap(mentionedIds));
  return { status: "ready", resolved, ...page, names };
}

export function AuditLog({
  supabase,
  bcp47,
  paths,
  strings: s,
}: AdminViewProps & { strings: AuditStrings }) {
  const id = useId();
  // The view renders in the browser only (after the role check), so the URL is there.
  const [filter] = useState<AuditFilter>(() => filterFromSearch(location.search));
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void firstPage(supabase, filter).then(setState);
  }, [supabase, filter]);

  async function loadOlder() {
    if (state.status !== "ready" || busy) return;
    const last = state.entries.at(-1);
    if (!last) return;
    setBusy(true);
    const page = await fetchAudit(supabase, state.resolved, last.id);
    const names = page
      ? await fetchNicknames(supabase, page.entries.flatMap(mentionedIds))
      : new Map<string, string>();
    setBusy(false);
    if (!page) return;
    setState((current) =>
      current.status === "ready"
        ? {
            ...current,
            entries: [...current.entries, ...page.entries],
            more: page.more,
            names: new Map([...current.names, ...names]),
          }
        : current,
    );
  }

  const href = (f: AuditFilter) => `${paths.audit}${searchFromFilter(f)}`;
  const byLabel = (labels: Record<string, string>) =>
    Object.entries(labels).sort(([, a], [, b]) => a.localeCompare(b, bcp47));
  const filtered = Object.keys(filter).length > 0;

  return (
    <div className="grid gap-6">
      <form
        method="get"
        action={paths.audit}
        aria-label={s.filters}
        className="grid gap-4 rounded-2xl border border-border bg-surface p-4 md:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field id={`${id}-actor`} label={s.actor} hint={s.actorHint}>
            <Input
              id={`${id}-actor`}
              name="actor"
              defaultValue={filter.actor ?? ""}
              autoComplete="off"
              maxLength={64}
              aria-describedby={`${id}-actor-hint`}
              aria-invalid={
                state.status === "unknown" && state.field === "actor" ? true : undefined
              }
            />
          </Field>
          <Field id={`${id}-action`} label={s.action}>
            <select
              id={`${id}-action`}
              name="action"
              defaultValue={filter.action ?? ""}
              className={selectClass}
            >
              <option value="">{s.anyAction}</option>
              {byLabel(s.actions).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-type`} label={s.targetType}>
            <select
              id={`${id}-type`}
              name="type"
              defaultValue={filter.type ?? ""}
              className={selectClass}
            >
              <option value="">{s.anyTarget}</option>
              {byLabel(s.targets).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-target`} label={s.target}>
            <Input
              id={`${id}-target`}
              name="target"
              defaultValue={filter.target ?? ""}
              autoComplete="off"
              maxLength={128}
              aria-invalid={
                state.status === "unknown" && state.field === "target" ? true : undefined
              }
            />
          </Field>
          <Field id={`${id}-from`} label={s.from}>
            <Input id={`${id}-from`} name="from" type="date" defaultValue={filter.from ?? ""} />
          </Field>
          <Field id={`${id}-to`} label={s.to}>
            <Input id={`${id}-to`} name="to" type="date" defaultValue={filter.to ?? ""} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{s.apply}</Button>
          {filtered && (
            <a href={paths.audit} className={buttonVariants({ variant: "ghost" })}>
              {s.clear}
            </a>
          )}
        </div>
      </form>

      {state.status === "loading" && (
        <p className="min-h-32 text-muted" aria-busy="true">
          {s.loading}
        </p>
      )}
      {state.status === "failed" && (
        <div className="grid justify-items-start gap-3">
          <p role="alert">{s.failed}</p>
          <Button
            variant="outline"
            onClick={() => {
              setState({ status: "loading" });
              void firstPage(supabase, filter).then(setState);
            }}
          >
            {s.retry}
          </Button>
        </div>
      )}
      {state.status === "unknown" && (
        <p role="alert" className="font-semibold text-danger">
          {state.field === "actor" ? s.unknownActor : s.unknownTarget}
        </p>
      )}
      {state.status === "ready" &&
        (state.entries.length === 0 ? (
          <EmptyState icon={<ScrollText />} title={s.empty} />
        ) : (
          <div className="grid gap-4">
            <ol className="grid gap-3">
              {state.entries.map((entry) => (
                <li key={entry.id}>
                  <Entry
                    entry={entry}
                    names={state.names}
                    strings={s}
                    bcp47={bcp47}
                    profileBase={paths.profileBase}
                    href={href}
                  />
                </li>
              ))}
            </ol>
            {state.more && (
              <Button
                variant="outline"
                className="justify-self-center"
                disabled={busy}
                onClick={() => void loadOlder()}
              >
                {s.more}
              </Button>
            )}
          </div>
        ))}
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint !== undefined && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

function Entry({
  entry,
  names,
  strings: s,
  bcp47,
  profileBase,
  href,
}: {
  entry: AuditEntry;
  names: Names;
  strings: AuditStrings;
  bcp47: string;
  profileBase: string;
  href: (filter: AuditFilter) => string;
}) {
  /** A player's nickname, or "No profile" (deleted, or never finished signing up). */
  const player = (id: string) => names.get(id) ?? s.noProfile;
  const profile = (id: string) => {
    const nickname = names.get(id);
    return nickname ? (
      <a href={`${profileBase}${encodeURIComponent(nickname)}/`} className="text-sm text-muted">
        {s.profile}
      </a>
    ) : null;
  };
  const when = new Date(entry.createdAt);
  const { targetType: type, targetId: target } = entry;
  const playerTarget = type !== null && PLAYER_TARGETS.includes(type);
  const targetName = target === null ? null : playerTarget ? player(target) : target;
  const details = Object.entries(entry.details);

  return (
    <article className="grid gap-2 rounded-2xl border border-border bg-surface p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-semibold">{s.actions[entry.action] ?? entry.action}</h2>
        <time dateTime={entry.createdAt} className="text-sm text-muted tabular-nums">
          {new Intl.DateTimeFormat(bcp47, { dateStyle: "medium", timeStyle: "short" }).format(when)}
        </time>
      </header>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
        <dt className="text-sm text-muted">{s.by}</dt>
        <dd className="flex flex-wrap items-baseline gap-x-3">
          {entry.actorId === null ? (
            s.system
          ) : (
            <>
              <a
                href={href({ actor: entry.actorId })}
                title={fill(s.onlyActor, { name: player(entry.actorId) })}
                className={linkClass}
              >
                {player(entry.actorId)}
              </a>
              {profile(entry.actorId)}
            </>
          )}
        </dd>
        {type !== null && (
          <>
            <dt className="text-sm text-muted">{s.about}</dt>
            <dd className="flex min-w-0 flex-wrap items-baseline gap-x-3">
              <span>{s.targets[type] ?? type}</span>
              {target !== null && targetName !== null && (
                <a
                  href={href({ type, target })}
                  title={fill(s.onlyTarget, { name: targetName })}
                  className={`${linkClass} break-all`}
                >
                  {targetName}
                </a>
              )}
              {playerTarget && target !== null && profile(target)}
            </dd>
          </>
        )}
        {details.length > 0 && (
          <>
            <dt className="text-sm text-muted">{s.details}</dt>
            <dd>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {details.map(([key, value]) => (
                  <li key={key} className="min-w-0 break-all">
                    <span className="text-muted">{key}:</span>{" "}
                    {typeof value === "string"
                      ? (names.get(value) ?? value)
                      : JSON.stringify(value)}
                  </li>
                ))}
              </ul>
            </dd>
          </>
        )}
      </dl>
    </article>
  );
}
