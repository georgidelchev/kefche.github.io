// The Players section (SPEC §14, Phase 10 step 3): find a player, then open
// their page: the profile and account, sanctions, reports by and about them,
// and their latest matches. The search lives in the URL (a GET form), and a
// player's page is the same address with `?player=<id>`, so links and the
// back button work as usual.
import { Users } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";

import { UserAvatar } from "@kefche/ui/components/avatar";
import { Badge } from "@kefche/ui/components/badge";
import { Button, buttonVariants } from "@kefche/ui/components/button";
import { Input } from "@kefche/ui/components/input";
import { EmptyState } from "@kefche/ui/components/states";

import { avatarUrl } from "@/features/account/avatar-url";
import { fill } from "@/features/auth/strings";
import type { Supabase } from "@/lib/supabase/client";
import { supabaseConfig } from "@/lib/supabase/config";

import { searchFromFilter } from "./audit-data";
import { playerPage } from "./links";
import {
  ActionDialog,
  ActionsPanel,
  performAction,
  permissions,
  type ActionRequest,
} from "./PlayerActions";
import {
  ACCOUNT_FILTERS,
  fetchPlayerPage,
  findPlayers,
  inForce,
  playerFromUrl,
  ROLE_FILTERS,
  SANCTION_FILTERS,
  searchFromUrl,
  type Player,
  type PlayerPage,
  type PlayerRow,
  type PlayerSearch,
  type Report,
  type Sanction,
} from "./players-data";
import { dateTime, Field, linkClass, selectClass } from "./ui";

import type { PlayersStrings } from "../strings";
import type { AdminViewProps } from "../views";

type Props = AdminViewProps & { strings: PlayersStrings };

export function Players(props: Props) {
  // The view renders in the browser only (after the role check), so the URL is there.
  const [player] = useState(() => playerFromUrl(location.search));
  return player ? <PlayerView {...props} id={player} /> : <SearchView {...props} />;
}

/** The avatar's image, when it has one. */
const avatarSrc = (fields: {
  avatar_kind: string;
  avatar_preset: string | null;
  avatar_path: string | null;
}) => (supabaseConfig ? avatarUrl(fields, supabaseConfig.url) : null);

function Loading({ text }: { text: string }) {
  return (
    <p className="min-h-32 text-muted" aria-busy="true">
      {text}
    </p>
  );
}

function Failed({ strings: s, onRetry }: { strings: PlayersStrings; onRetry: () => void }) {
  return (
    <div className="grid justify-items-start gap-3">
      <p role="alert">{s.failed}</p>
      <Button variant="outline" onClick={onRetry}>
        {s.retry}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The search
// ---------------------------------------------------------------------------

type SearchState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; players: PlayerRow[]; more: boolean };

const firstResults = async (supabase: Supabase, search: PlayerSearch): Promise<SearchState> => {
  const page = await findPlayers(supabase, search, 0);
  return page ? { status: "ready", ...page } : { status: "failed" };
};

function SearchView({ supabase, roles, bcp47, paths, strings: s }: Props) {
  const id = useId();
  const [search] = useState<PlayerSearch>(() => searchFromUrl(location.search));
  const [state, setState] = useState<SearchState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const admin = roles.includes("admin");

  useEffect(() => {
    void firstResults(supabase, search).then(setState);
  }, [supabase, search]);

  async function loadMore() {
    if (state.status !== "ready" || busy) return;
    setBusy(true);
    const page = await findPlayers(supabase, search, state.players.length);
    setBusy(false);
    if (!page) return;
    setState((current) =>
      current.status === "ready"
        ? { ...current, players: [...current.players, ...page.players], more: page.more }
        : current,
    );
  }

  const searched = Object.keys(search).length > 0;
  return (
    <div className="grid gap-6">
      <form
        role="search"
        method="get"
        action={paths.users}
        aria-label={s.search}
        className="grid gap-4 rounded-2xl border border-border bg-surface p-4 md:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field id={`${id}-q`} label={s.query} hint={admin ? s.queryHintAdmin : s.queryHint}>
            <Input
              id={`${id}-q`}
              name="q"
              type="search"
              defaultValue={search.q ?? ""}
              autoComplete="off"
              maxLength={100}
              aria-describedby={`${id}-q-hint`}
            />
          </Field>
          <Field id={`${id}-role`} label={s.role}>
            <select
              id={`${id}-role`}
              name="role"
              defaultValue={search.role ?? ""}
              className={selectClass}
            >
              <option value="">{s.anyRole}</option>
              {ROLE_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {s.roles[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-sanction`} label={s.sanction}>
            <select
              id={`${id}-sanction`}
              name="sanction"
              defaultValue={search.sanction ?? ""}
              className={selectClass}
            >
              <option value="">{s.anySanction}</option>
              {SANCTION_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {s.sanctions[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-account`} label={s.account}>
            <select
              id={`${id}-account`}
              name="account"
              defaultValue={search.account ?? ""}
              className={selectClass}
            >
              <option value="">{s.anyAccount}</option>
              {ACCOUNT_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {s.accounts[value]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{s.apply}</Button>
          {searched && (
            <a href={paths.users} className={buttonVariants({ variant: "ghost" })}>
              {s.clear}
            </a>
          )}
        </div>
      </form>

      {state.status === "loading" && <Loading text={s.loading} />}
      {state.status === "failed" && (
        <Failed
          strings={s}
          onRetry={() => {
            setState({ status: "loading" });
            void firstResults(supabase, search).then(setState);
          }}
        />
      )}
      {state.status === "ready" &&
        (state.players.length === 0 ? (
          <EmptyState icon={<Users />} title={s.empty} />
        ) : (
          <section aria-labelledby={`${id}-results`} className="grid gap-4">
            <h2 id={`${id}-results`} className="sr-only">
              {s.results}
            </h2>
            <ul className="grid gap-2">
              {state.players.map((player) => (
                <li key={player.id}>
                  <PlayerCard
                    player={player}
                    strings={s}
                    bcp47={bcp47}
                    href={playerPage(paths)(player.id)}
                  />
                </li>
              ))}
            </ul>
            {state.more && (
              <Button
                variant="outline"
                className="justify-self-center"
                disabled={busy}
                onClick={() => void loadMore()}
              >
                {s.more}
              </Button>
            )}
          </section>
        ))}
    </div>
  );
}

/** A player's badges: guest, staff roles and the sanction in force. */
function Badges({
  guest,
  roles,
  sanction,
  strings: s,
}: {
  guest: boolean;
  roles: readonly string[];
  sanction: string | null;
  strings: PlayersStrings;
}) {
  const sanctionLabel =
    sanction === "mute" || sanction === "suspend" || sanction === "ban"
      ? s.sanctions[sanction]
      : null;
  if (!guest && roles.length === 0 && !sanctionLabel) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {guest && <Badge>{s.guest}</Badge>}
      {roles.map((role) => (
        <Badge key={role} variant="brand">
          {s.staffRoles[role] ?? role}
        </Badge>
      ))}
      {sanctionLabel && <Badge variant="danger">{sanctionLabel}</Badge>}
    </span>
  );
}

function PlayerCard({
  player,
  strings: s,
  bcp47,
  href,
}: {
  player: PlayerRow;
  strings: PlayersStrings;
  bcp47: string;
  href: string;
}) {
  const name = player.nickname ?? s.noNickname;
  const src = avatarSrc(player);
  return (
    <a
      href={href}
      className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface p-3 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <UserAvatar name={name} id={player.id} {...(src && { src })} />
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={`truncate font-semibold ${player.nickname === null ? "text-muted italic" : ""}`}
          >
            {name}
          </span>
          <Badges
            guest={player.guest}
            roles={player.roles}
            sanction={player.sanction}
            strings={s}
          />
        </span>
        <span className="flex flex-wrap gap-x-4 text-sm text-muted">
          {player.email !== null && <span className="min-w-0 break-all">{player.email}</span>}
          <span>
            {fill(s.joined, {
              date: new Intl.DateTimeFormat(bcp47, { dateStyle: "medium" }).format(
                new Date(player.created_at),
              ),
            })}
          </span>
        </span>
      </span>
    </a>
  );
}

// ---------------------------------------------------------------------------
// A player's page
// ---------------------------------------------------------------------------

type PageState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "missing" }
  | { status: "ready"; page: PlayerPage };

const loadPage = async (supabase: Supabase, id: string): Promise<PageState> => {
  const page = await fetchPlayerPage(supabase, id);
  if (page === null) return { status: "failed" };
  if (page === undefined) return { status: "missing" };
  return { status: "ready", page };
};

function PlayerView({
  supabase,
  userId,
  roles,
  bcp47,
  paths,
  strings: s,
  id,
}: Props & { id: string }) {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [request, setRequest] = useState<ActionRequest | null>(null);
  /** Remounts the dialog on each opening, so its form starts afresh. */
  const [opened, setOpened] = useState(0);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const ask = (next: ActionRequest) => {
    setOutcome(null);
    setOpened((n) => n + 1);
    setRequest(next);
  };

  useEffect(() => {
    void loadPage(supabase, id).then(setState);
  }, [supabase, id]);

  const back = (
    <a href={paths.users} className={`${linkClass} justify-self-start`}>
      {s.back}
    </a>
  );
  if (state.status === "loading") return <Loading text={s.loading} />;
  if (state.status === "failed")
    return (
      <Failed
        strings={s}
        onRetry={() => {
          setState({ status: "loading" });
          void loadPage(supabase, id).then(setState);
        }}
      />
    );
  if (state.status === "missing")
    return (
      <div className="grid gap-4">
        <p role="alert">{s.notFound}</p>
        {back}
      </div>
    );

  const { player, sanctions, reportsAbout, reportsBy, names } = state.page;
  const name = player.nickname ?? s.noNickname;
  const src = avatarSrc({
    avatar_kind: player.avatarKind,
    avatar_preset: player.avatarPreset,
    avatar_path: player.avatarPath,
  });
  const nameOf = (other: string | null) =>
    other === null ? s.noProfile : (names.get(other) ?? s.noProfile);
  const can = permissions(player, userId, roles);

  async function confirm(sanction: Parameters<typeof performAction>[3]) {
    if (request === null) return;
    const error = await performAction(supabase, player, request, sanction, s.act);
    // Reloaded in place (no loading state), then the outcome, so both agree.
    const next = await loadPage(supabase, id);
    if (next.status === "ready" || next.status === "missing") setState(next);
    setRequest(null);
    setOutcome(error === null ? { ok: true, text: s.act.done } : { ok: false, text: error });
  }

  return (
    <div className="grid gap-6">
      {back}
      <section
        aria-labelledby="player-name"
        className="grid gap-5 rounded-2xl border border-border bg-surface p-4 md:p-5"
      >
        <header className="flex flex-wrap items-center gap-4">
          <UserAvatar name={name} id={player.id} size="lg" {...(src && { src })} />
          <div className="grid min-w-0 gap-2">
            <h2
              id="player-name"
              className={`text-2xl break-words ${player.nickname === null ? "text-muted italic" : ""}`}
            >
              {name}
            </h2>
            <Badges
              guest={player.guest}
              roles={player.roles}
              sanction={player.sanction}
              strings={s}
            />
            <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {player.nickname !== null && (
                <a
                  href={`${paths.profileBase}${encodeURIComponent(player.nickname)}/`}
                  className={linkClass}
                >
                  {s.profile}
                </a>
              )}
              {roles.includes("admin") && (
                <a
                  href={`${paths.audit}${searchFromFilter({ type: "user", target: player.id })}`}
                  className={linkClass}
                >
                  {s.inAudit}
                </a>
              )}
            </span>
          </div>
        </header>
        <Account player={player} strings={s} bcp47={bcp47} />
      </section>

      {(can.reset || can.sanction || can.roles || can.delete) && (
        <Section title={s.act.title}>
          <ActionsPanel
            player={player}
            userId={userId}
            roles={roles}
            strings={s}
            outcome={outcome}
            onRequest={ask}
          />
        </Section>
      )}
      {request !== null && (
        <ActionDialog
          key={opened}
          request={request}
          name={name}
          admin={can.admin}
          strings={s}
          onClose={() => {
            setRequest(null);
          }}
          onConfirm={confirm}
        />
      )}

      <Section title={s.sanctionsTitle}>
        {sanctions.length === 0 ? (
          <p className="text-muted">{s.noSanctions}</p>
        ) : (
          <ul className="grid gap-3">
            {sanctions.map((sanction) => (
              <li key={sanction.id}>
                <SanctionItem
                  sanction={sanction}
                  strings={s}
                  bcp47={bcp47}
                  nameOf={nameOf}
                  {...(inForce(sanction) &&
                    can.revoke(sanction) && {
                      onRevoke: () => {
                        ask({ type: "revoke", sanction });
                      },
                    })}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title={s.reportsAbout}>
          <Reports
            reports={reportsAbout}
            strings={s}
            bcp47={bcp47}
            label={s.reporter}
            other={(r) => r.reporterId}
            nameOf={nameOf}
            href={playerPage(paths)}
          />
        </Section>
        <Section title={s.reportsBy}>
          <Reports
            reports={reportsBy}
            strings={s}
            bcp47={bcp47}
            label={s.reported}
            other={(r) => r.targetUserId}
            nameOf={nameOf}
            href={playerPage(paths)}
          />
        </Section>
      </div>

      <Section title={s.matches}>
        <Matches matches={player.matches} strings={s} bcp47={bcp47} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="grid content-start gap-3">
      <h2 id={id} className="text-xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Label and value pairs, two columns from small screens. */
function Pairs({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="grid min-w-0 gap-0.5">
          <dt className="text-sm text-muted">{label}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Account({
  player,
  strings: s,
  bcp47,
}: {
  player: Player;
  strings: PlayersStrings;
  bcp47: string;
}) {
  const region = (code: string) => {
    try {
      return new Intl.DisplayNames(bcp47, { type: "region" }).of(code) ?? code;
    } catch {
      return code;
    }
  };
  const items: [string, ReactNode][] = [
    [
      s.id,
      <code key="id" className="text-sm break-all">
        {player.id}
      </code>,
    ],
  ];
  if (player.email !== null)
    items.push([
      s.email,
      <span key="email" className="break-all">
        {player.email}
      </span>,
    ]);
  items.push(
    [s.joinedAt, dateTime(player.createdAt, bcp47)],
    [s.lastSignIn, player.lastSignInAt ? dateTime(player.lastSignInAt, bcp47) : s.never],
    [
      s.level,
      fill(s.levelValue, {
        level: player.level.toLocaleString(bcp47),
        xp: player.xp.toLocaleString(bcp47),
      }),
    ],
  );
  if (player.country !== null) items.push([s.country, region(player.country)]);
  if (player.nicknameChangedAt !== null)
    items.push([s.nicknameChanged, dateTime(player.nicknameChangedAt, bcp47)]);
  if (player.deletionAt !== null)
    items.push([
      s.deletion,
      <span key="deletion" className="font-semibold text-danger">
        {dateTime(player.deletionAt, bcp47)}
      </span>,
    ]);
  return (
    <div className="grid gap-4">
      <Pairs items={items} />
      <div className="grid gap-0.5">
        <h3 className="text-sm font-normal text-muted">{s.bio}</h3>
        <p className={player.bio === null ? "text-muted" : "break-words whitespace-pre-line"}>
          {player.bio ?? s.noBio}
        </p>
      </div>
    </div>
  );
}

function SanctionItem({
  sanction,
  strings: s,
  bcp47,
  nameOf,
  onRevoke,
}: {
  sanction: Sanction;
  strings: PlayersStrings;
  bcp47: string;
  nameOf: (id: string | null) => string;
  onRevoke?: () => void;
}) {
  const items: [string, ReactNode][] = [
    [s.reason, s.reasons[sanction.reason] ?? sanction.reason],
    [s.given, dateTime(sanction.startsAt, bcp47)],
  ];
  if (sanction.kind !== "warn")
    items.push([s.ends, sanction.endsAt ? dateTime(sanction.endsAt, bcp47) : s.noEnd]);
  items.push([s.by, sanction.createdBy === null ? s.automatic : nameOf(sanction.createdBy)]);
  if (sanction.revokedAt !== null)
    items.push(
      [s.revoked, dateTime(sanction.revokedAt, bcp47)],
      [s.revokedBy, nameOf(sanction.revokedBy)],
    );
  if (sanction.note !== null) items.push([s.note, sanction.note]);
  return (
    <article className="grid gap-3 rounded-2xl border border-border bg-surface p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold">{s.kinds[sanction.kind] ?? sanction.kind}</h3>
        {inForce(sanction) && <Badge variant="danger">{s.inForce}</Badge>}
        {onRevoke && (
          <Button variant="outline" className="ms-auto" onClick={onRevoke}>
            {s.act.revoke}
          </Button>
        )}
      </header>
      <Pairs items={items} />
    </article>
  );
}

function Reports({
  reports,
  strings: s,
  bcp47,
  label,
  other,
  nameOf,
  href,
}: {
  reports: Report[];
  strings: PlayersStrings;
  bcp47: string;
  /** What the other player is: who reported, or who was reported. */
  label: string;
  other: (report: Report) => string | null;
  nameOf: (id: string | null) => string;
  href: (id: string) => string;
}) {
  if (reports.length === 0) return <p className="text-muted">{s.noReports}</p>;
  return (
    <ul className="grid gap-3">
      {reports.map((report) => {
        const otherId = other(report);
        return (
          <li key={report.id}>
            <article className="grid gap-2 rounded-2xl border border-border bg-surface p-4">
              <header className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold">
                  {s.targets[report.targetType] ?? report.targetType}
                  {" · "}
                  {s.reasons[report.reason] ?? report.reason}
                </h3>
                <Badge variant={report.status === "open" ? "accent" : "neutral"}>
                  {s.statuses[report.status] ?? report.status}
                </Badge>
              </header>
              <p className="flex flex-wrap gap-x-4 text-sm text-muted">
                <time dateTime={report.createdAt}>{dateTime(report.createdAt, bcp47)}</time>
                <span>
                  {label}:{" "}
                  {otherId === null ? (
                    s.noProfile
                  ) : (
                    <a href={href(otherId)} className={linkClass}>
                      {nameOf(otherId)}
                    </a>
                  )}
                </span>
              </p>
              {report.details !== null && <p className="break-words">{report.details}</p>}
            </article>
          </li>
        );
      })}
    </ul>
  );
}

function Matches({
  matches,
  strings: s,
  bcp47,
}: {
  matches: Player["matches"];
  strings: PlayersStrings;
  bcp47: string;
}) {
  if (matches.length === 0) return <p className="text-muted">{s.noMatches}</p>;
  const outcome = (value: number) =>
    value === 1 ? s.outcomes.win : value === 0 ? s.outcomes.loss : s.outcomes.draw;
  return (
    <ul className="grid gap-2">
      {matches.map((match) => (
        <li
          key={match.id}
          className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-border bg-surface p-3"
        >
          <span className="font-semibold">{s.games[match.gameId] ?? match.gameId}</span>
          {match.others.length > 0 && (
            <>
              <span>{outcome(match.outcome)}</span>
              <span className="min-w-0 text-sm break-words text-muted">
                {fill(s.against, {
                  names: match.others.map((n) => (n === "" ? s.noProfile : n)).join(", "),
                })}
              </span>
            </>
          )}
          {match.rated && <Badge>{s.rated}</Badge>}
          {match.status === "review" && <Badge variant="accent">{s.review}</Badge>}
          <time dateTime={match.endedAt} className="ms-auto text-sm text-muted tabular-nums">
            {dateTime(match.endedAt, bcp47)}
          </time>
        </li>
      ))}
    </ul>
  );
}
