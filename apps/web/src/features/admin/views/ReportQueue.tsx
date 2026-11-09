// The moderation queue (SPEC §14, Phase 10 step 4): open reports grouped by
// what was reported, longest waiting first, with how long each has waited
// (late after a day, very late after three). Each shows the reported copy,
// the reports, and for a message the conversation around it. Staff dismiss
// (what was hidden comes back), remove, or remove and sanction in one step,
// one at a time or for a selection.
import { Clock, Flag } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Badge } from "@kefche/ui/components/badge";
import { Button } from "@kefche/ui/components/button";
import { EmptyState } from "@kefche/ui/components/states";

import { avatarUrl } from "@/features/account/avatar-url";
import { fill } from "@/features/auth/strings";
import { MessageBody } from "@/features/chat/MessageBody";
import type { Supabase } from "@/lib/supabase/client";
import { supabaseConfig } from "@/lib/supabase/config";

import { ConfirmDialog } from "./ConfirmDialog";
import { playerPage } from "./links";
import { ActionDialog, errorText, type SanctionInput } from "./PlayerActions";
import {
  ago,
  fetchContext,
  fetchQueue,
  itemKey,
  REPORT_TYPES,
  removeAndSanction,
  resolveItem,
  typeFromUrl,
  waitLevel,
  type ContextMessage,
  type QueueItem,
  type ReportType,
} from "./report-queue-data";
import { dateTime, Field, linkClass, selectClass } from "./ui";

import type { PlayersStrings, ReportsStrings } from "../strings";
import type { AdminViewProps } from "../views";

type Props = AdminViewProps & { strings: ReportsStrings; players: PlayersStrings };
type State = { status: "loading" } | { status: "failed" } | { status: "ready"; items: QueueItem[] };
/** An action waiting for confirmation: on one item, or on the selection. */
type Pending =
  { kind: "dismissed" | "actioned"; items: QueueItem[] } | { kind: "sanction"; item: QueueItem };

const load = async (supabase: Supabase, type: ReportType | null): Promise<State> => {
  const items = await fetchQueue(supabase, type);
  return items ? { status: "ready", items } : { status: "failed" };
};

const str = (value: unknown) => (typeof value === "string" ? value : null);

export function ReportQueue({ supabase, roles, bcp47, paths, strings: s, players }: Props) {
  const id = useId();
  // The view renders in the browser only (after the role check), so the URL is there.
  const [type] = useState(() => typeFromUrl(location.search));
  const [state, setState] = useState<State>({ status: "loading" });
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [pending, setPending] = useState<Pending | null>(null);
  const [opened, setOpened] = useState(0);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void load(supabase, type).then(setState);
  }, [supabase, type]);

  const items = state.status === "ready" ? state.items : [];
  const chosen = items.filter((item) => selected.has(itemKey(item)));
  const ask = (next: Pending) => {
    setOutcome(null);
    setOpened((n) => n + 1);
    setPending(next);
  };
  /** What an item is, for a label: its type and its player. */
  const describe = (item: QueueItem) =>
    `${typeLabel(item, s)} · ${item.target_nickname ?? players.noNickname}`;

  /** Runs the action, reloads the queue in place, then says how it went. */
  async function run(action: () => Promise<string[]>) {
    const errors = await action();
    const next = await load(supabase, type);
    if (next.status === "ready") {
      setState(next);
      const open = new Set(next.items.map(itemKey));
      setSelected((current) => new Set([...current].filter((key) => open.has(key))));
    }
    setPending(null);
    const first = errors[0];
    setOutcome(
      first === undefined
        ? { ok: true, text: s.done }
        : {
            ok: false,
            text: errors.length > 1 ? s.partial : errorText(first, players.act),
          },
    );
  }

  async function resolveAll(kind: "dismissed" | "actioned", list: QueueItem[]) {
    await run(async () => {
      const errors: string[] = [];
      for (const item of list) {
        const error = await resolveItem(supabase, item, kind);
        if (error !== null) errors.push(error);
      }
      return errors;
    });
  }

  return (
    <div className="grid gap-6">
      <form
        method="get"
        action={paths.reports}
        aria-label={s.type}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4"
      >
        <div className="min-w-56 flex-1 sm:flex-none">
          <Field id={`${id}-type`} label={s.type}>
            <select id={`${id}-type`} name="type" defaultValue={type ?? ""} className={selectClass}>
              <option value="">{s.anyType}</option>
              {REPORT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {s.types[value]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Button type="submit">{s.apply}</Button>
      </form>

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-muted tabular-nums">
            {fill(s.selected, { count: chosen.length.toLocaleString(bcp47) })}
          </span>
          <Button
            variant="outline"
            disabled={chosen.length === 0}
            onClick={() => {
              ask({ kind: "dismissed", items: chosen });
            }}
          >
            {s.dismissSelected}
          </Button>
          <Button
            variant="outline"
            disabled={chosen.length === 0}
            onClick={() => {
              ask({ kind: "actioned", items: chosen });
            }}
          >
            {s.removeSelected}
          </Button>
        </div>
      )}
      {/* Always in the page, so screen readers hear each outcome. */}
      <p
        role="status"
        className={outcome?.ok === false ? "font-semibold text-danger" : "text-muted empty:hidden"}
      >
        {outcome?.text ?? ""}
      </p>

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
              void load(supabase, type).then(setState);
            }}
          >
            {s.retry}
          </Button>
        </div>
      )}
      {state.status === "ready" &&
        (items.length === 0 ? (
          <EmptyState icon={<Flag />} title={s.empty} />
        ) : (
          <ol className="grid gap-4">
            {items.map((item) => {
              const key = itemKey(item);
              return (
                <li key={key}>
                  <Item
                    item={item}
                    supabase={supabase}
                    strings={s}
                    players={players}
                    bcp47={bcp47}
                    playerHref={playerPage(paths)}
                    label={describe(item)}
                    selected={selected.has(key)}
                    onSelect={(on) => {
                      setSelected((current) => {
                        const next = new Set(current);
                        if (on) next.add(key);
                        else next.delete(key);
                        return next;
                      });
                    }}
                    onAction={ask}
                  />
                </li>
              );
            })}
          </ol>
        ))}

      {pending?.kind === "sanction" && (
        <ActionDialog
          key={opened}
          request={{ type: "sanction" }}
          name={pending.item.target_nickname ?? players.noNickname}
          admin={roles.includes("admin")}
          strings={players}
          reason={pending.item.reports.at(-1)?.reason ?? "spam"}
          sanctionBody={s.sanctionBody}
          onClose={() => {
            setPending(null);
          }}
          onConfirm={(sanction: SanctionInput) =>
            run(async () => {
              const error = await removeAndSanction(supabase, pending.item, sanction);
              return error === null ? [] : [error];
            })
          }
        />
      )}
      {pending !== null && pending.kind !== "sanction" && (
        <ConfirmDialog
          key={opened}
          title={
            pending.items.length > 1
              ? pending.kind === "dismissed"
                ? s.dismissSelected
                : s.removeSelected
              : pending.kind === "dismissed"
                ? s.dismissTitle
                : s.removeTitle
          }
          body={
            pending.items.length > 1
              ? fill(s.bulkBody, { count: pending.items.length.toLocaleString(bcp47) })
              : pending.kind === "dismissed"
                ? s.dismissBody
                : (s.removeBody[pending.items[0]?.target_type ?? ""] ?? "")
          }
          confirm={pending.kind === "dismissed" ? s.dismiss : s.remove}
          danger={pending.kind === "actioned"}
          strings={players.act}
          onClose={() => {
            setPending(null);
          }}
          onConfirm={() => resolveAll(pending.kind, pending.items)}
        />
      )}
    </div>
  );
}

/** "Direct message", or the type's name. */
function typeLabel(item: QueueItem, s: ReportsStrings): string {
  if (item.target_type === "message" && str(item.snapshot.conversation) !== null) return s.dm;
  return s.types[item.target_type] ?? item.target_type;
}

function Item({
  item,
  supabase,
  strings: s,
  players,
  bcp47,
  playerHref,
  label,
  selected,
  onSelect,
  onAction,
}: {
  item: QueueItem;
  supabase: Supabase;
  strings: ReportsStrings;
  players: PlayersStrings;
  bcp47: string;
  playerHref: (id: string) => string;
  label: string;
  selected: boolean;
  onSelect: (on: boolean) => void;
  onAction: (pending: Pending) => void;
}) {
  const id = useId();
  const level = waitLevel(item.first_at);
  const isMessage = item.target_type === "message" || item.target_type === "room_message";
  return (
    <article
      aria-labelledby={`${id}-title`}
      className={`grid gap-4 rounded-2xl border bg-surface p-4 md:p-5 ${
        level === "veryLate"
          ? "border-danger"
          : level === "late"
            ? "border-warning"
            : "border-border"
      }`}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <input
          type="checkbox"
          checked={selected}
          aria-label={fill(s.select, { item: label })}
          onChange={(e) => {
            onSelect(e.currentTarget.checked);
          }}
          className="size-5 cursor-pointer accent-brand"
        />
        <h2 id={`${id}-title`} className="text-lg">
          {typeLabel(item, s)}
        </h2>
        <Badge>{fill(s.count, { count: item.reports.length.toLocaleString(bcp47) })}</Badge>
        {item.held && <Badge variant="accent">{s.held}</Badge>}
        {level !== "ok" && (
          <span
            className={`inline-flex items-center gap-1 text-sm font-semibold ${
              level === "veryLate" ? "text-danger" : "text-warning"
            }`}
          >
            <Clock aria-hidden="true" className="size-4" />
            {level === "veryLate" ? s.veryLate : s.late}
          </span>
        )}
      </header>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        {item.target_user_id !== null && (
          <a href={playerHref(item.target_user_id)} className={linkClass}>
            {item.target_nickname ?? players.noNickname}
          </a>
        )}
        <time dateTime={item.first_at} title={dateTime(item.first_at, bcp47)}>
          {fill(s.firstReported, { ago: ago(item.first_at, bcp47) })}
        </time>
      </p>

      <Reported item={item} strings={s} players={players} />
      {isMessage && <Context item={item} supabase={supabase} strings={s} players={players} />}

      <div className="grid gap-2">
        <h3 className="text-sm font-normal text-muted">{s.reportedBy}</h3>
        <ul className="grid gap-2">
          {item.reports.map((report) => (
            <li key={report.id} className="grid gap-0.5">
              <span className="flex flex-wrap items-baseline gap-x-3">
                {report.reporterId === null ? (
                  <span>{players.noProfile}</span>
                ) : (
                  <a href={playerHref(report.reporterId)} className={linkClass}>
                    {report.reporter ?? players.noNickname}
                  </a>
                )}
                <span>{players.reasons[report.reason] ?? report.reason}</span>
                <time dateTime={report.at} className="text-sm text-muted">
                  {dateTime(report.at, bcp47)}
                </time>
              </span>
              {report.details !== null && (
                <span className="break-words text-muted" dir="auto">
                  {report.details}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => {
            onAction({ kind: "dismissed", items: [item] });
          }}
        >
          {s.dismiss}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            onAction({ kind: "actioned", items: [item] });
          }}
        >
          {s.remove}
        </Button>
        {item.target_user_id !== null && (
          <Button
            variant="danger"
            onClick={() => {
              onAction({ kind: "sanction", item });
            }}
          >
            {s.removeAndSanction}
          </Button>
        )}
      </div>
    </article>
  );
}

/** The reported copy, as the newest report kept it. */
function Reported({
  item,
  strings: s,
  players,
}: {
  item: QueueItem;
  strings: ReportsStrings;
  players: PlayersStrings;
}) {
  const snap = item.snapshot;
  const box = "grid gap-2 rounded-xl bg-surface-2 p-3";
  if (item.target_type === "user") {
    return (
      <dl className={box}>
        <div className="grid gap-0.5">
          <dt className="text-sm text-muted">{s.nickname}</dt>
          <dd className="font-semibold break-words">{str(snap.nickname) ?? players.noNickname}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-sm text-muted">{players.bio}</dt>
          <dd className="break-words whitespace-pre-line" dir="auto">
            {str(snap.bio) ?? players.noBio}
          </dd>
        </div>
      </dl>
    );
  }
  if (item.target_type === "avatar") {
    const path = str(snap.path);
    const src =
      path && supabaseConfig
        ? avatarUrl(
            { avatar_kind: "upload", avatar_preset: null, avatar_path: path },
            supabaseConfig.url,
          )
        : null;
    return (
      <div className={box}>
        {src && (
          <img
            src={src}
            alt={s.avatarAlt}
            width={128}
            height={128}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="size-32 rounded-xl object-cover"
          />
        )}
      </div>
    );
  }
  const room = str(snap.room);
  const where =
    item.target_type === "room_message"
      ? fill(s.lobby, {
          code: room ?? "",
          game: players.games[str(snap.game) ?? ""] ?? str(snap.game) ?? "",
        })
      : str(snap.conversation) !== null
        ? s.dm
        : fill(s.globalRoom, { room: room?.toUpperCase() ?? "" });
  const body = str(snap.body);
  const gif = str(snap.gifId);
  return (
    <div className={box}>
      <p className="text-sm text-muted">
        {where}
        {" · "}
        {str(snap.nickname) ?? players.noNickname}
      </p>
      <p className="grid gap-2">
        {body === null && gif === null ? (
          <span className="text-muted italic">{s.deleted}</span>
        ) : (
          <MessageBody body={body} gifId={gif} gifAlt={s.gif} />
        )}
      </p>
    </div>
  );
}

type ContextState =
  | { status: "closed" }
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; messages: ContextMessage[] };

/** The messages around a reported one, loaded on request (a DM's read is audited). */
function Context({
  item,
  supabase,
  strings: s,
  players,
}: {
  item: QueueItem;
  supabase: Supabase;
  strings: ReportsStrings;
  players: PlayersStrings;
}) {
  const id = useId();
  const [state, setState] = useState<ContextState>({ status: "closed" });
  const dm = item.target_type === "message" && str(item.snapshot.conversation) !== null;
  const open = () => {
    setState({ status: "loading" });
    void fetchContext(supabase, item).then((messages) => {
      setState(messages ? { status: "ready", messages } : { status: "failed" });
    });
  };

  if (state.status === "closed" || state.status === "failed")
    return (
      <div className="grid justify-items-start gap-1">
        <Button variant="ghost" onClick={open}>
          {s.showContext}
        </Button>
        {dm && <p className="text-sm text-muted">{s.contextDm}</p>}
        {state.status === "failed" && <p role="alert">{s.failed}</p>}
      </div>
    );
  if (state.status === "loading")
    return (
      <p className="text-muted" aria-busy="true">
        {s.loading}
      </p>
    );
  return (
    <section aria-labelledby={`${id}-title`} className="grid gap-2">
      <h3 id={`${id}-title`} className="text-sm font-normal text-muted">
        {s.contextTitle}
      </h3>
      {state.messages.length === 0 ? (
        <p className="text-muted">{s.contextEmpty}</p>
      ) : (
        <ol className="grid gap-1 border-s-2 border-border ps-3">
          {state.messages.map((message) => {
            const reported = String(message.id) === item.target_id;
            return (
              <li
                key={message.id}
                className={`grid gap-0.5 rounded-lg px-2 py-1 ${reported ? "bg-surface-2 ring-2 ring-danger" : ""}`}
              >
                <span className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-semibold">{message.nickname ?? players.noNickname}</span>
                  {reported && <span className="text-danger">{s.reportedMessage}</span>}
                  {message.status === "hidden" && <span className="text-muted">{s.hidden}</span>}
                </span>
                {message.status === "deleted" ? (
                  <span className="text-muted italic">{s.deleted}</span>
                ) : (
                  <MessageBody body={message.body} gifId={message.gifId} gifAlt={s.gif} />
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
