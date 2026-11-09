// The chat tools (SPEC §14, Phase 10 step 5): the players muted now with
// their mute's end, each global room's slow mode, and searching global and
// lobby chat to delete a message (the short sections first). DMs aren't
// searchable (Q4). Every change goes through an audited RPC.
import { MessageSquare, MicOff } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Badge } from "@kefche/ui/components/badge";
import { Button } from "@kefche/ui/components/button";
import { Input } from "@kefche/ui/components/input";
import { EmptyState } from "@kefche/ui/components/states";

import { fill } from "@/features/auth/strings";
import { MessageBody } from "@/features/chat/MessageBody";
import { LOCALES, type Locale } from "@/i18n/locales";

import {
  deleteMessage,
  fetchMutes,
  fetchRooms,
  revokeMute,
  SCOPES,
  searchFromUrl,
  searchMessages,
  setSlowMode,
  SLOW_MODE_STEPS,
  slowModeLabel,
  type FoundMessage,
  type MessageSearch,
  type Mute,
  type Room,
} from "./chat-data";
import { ConfirmDialog } from "./ConfirmDialog";
import { playerPage } from "./links";
import { errorText } from "./PlayerActions";
import { dateTime, Field, linkClass, selectClass } from "./ui";

import type { ChatStrings, PlayersStrings } from "../strings";
import type { AdminViewProps } from "../views";

type Props = AdminViewProps & { strings: ChatStrings; players: PlayersStrings };
type Outcome = { ok: boolean; text: string } | null;

/** Language names in the page's language, for the global rooms. */
const roomNames = (bcp47: string) => {
  const names = new Intl.DisplayNames(bcp47, { type: "language" });
  return (room: string) => names.of(room) ?? room.toUpperCase();
};

export function ChatTools(props: Props) {
  const { strings: s } = props;
  return (
    <div className="grid gap-10">
      <section aria-labelledby="chat-muted" className="grid gap-4">
        <h2 id="chat-muted" className="text-xl">
          {s.mutedTitle}
        </h2>
        <Muted {...props} />
      </section>
      <section aria-labelledby="chat-slow" className="grid gap-4">
        <div className="grid gap-1">
          <h2 id="chat-slow" className="text-xl">
            {s.slowTitle}
          </h2>
          <p className="text-muted">{s.slowBody}</p>
        </div>
        <SlowMode {...props} />
      </section>
      <section aria-labelledby="chat-search" className="grid gap-4">
        <h2 id="chat-search" className="text-xl">
          {s.searchTitle}
        </h2>
        <Search {...props} />
      </section>
    </div>
  );
}

type SearchState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; messages: FoundMessage[]; more: boolean };

function Search({ supabase, bcp47, paths, strings: s, players }: Props) {
  const id = useId();
  const [search] = useState<MessageSearch>(() => searchFromUrl(location.search));
  const [scope, setScope] = useState(search.scope);
  const [state, setState] = useState<SearchState>({ status: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [pending, setPending] = useState<FoundMessage | null>(null);
  const [opened, setOpened] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const roomName = roomNames(bcp47);
  const playerHref = playerPage(paths);

  const load = () =>
    searchMessages(supabase, search, null).then((page) => {
      setState(page ? { status: "ready", ...page } : { status: "failed" });
    });
  useEffect(() => {
    void searchMessages(supabase, search, null).then((page) => {
      setState(page ? { status: "ready", ...page } : { status: "failed" });
    });
  }, [supabase, search]);

  async function more() {
    if (state.status !== "ready") return;
    setLoadingMore(true);
    const page = await searchMessages(supabase, search, state.messages.at(-1)?.id ?? null);
    setLoadingMore(false);
    if (page)
      setState({ status: "ready", ...page, messages: [...state.messages, ...page.messages] });
  }

  /** Deletes, takes the message out of the list, then says how it went. */
  async function remove(message: FoundMessage) {
    const error = await deleteMessage(supabase, message);
    if (error === null && state.status === "ready")
      setState({ ...state, messages: state.messages.filter((m) => m !== message) });
    setPending(null);
    setOutcome(
      error === null
        ? { ok: true, text: s.done }
        : { ok: false, text: errorText(error, players.act) },
    );
  }

  const where = (message: FoundMessage) =>
    message.kind === "room_message"
      ? fill(s.lobby, {
          code: message.lobby_code ?? "",
          game: players.games[message.lobby_game ?? ""] ?? message.lobby_game ?? "",
        })
      : fill(s.globalRoom, { room: roomName(message.room ?? "") });

  return (
    <div className="grid gap-4">
      <form
        method="get"
        action={paths.chat}
        role="search"
        aria-label={s.searchTitle}
        className="grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Field id={`${id}-scope`} label={s.scope}>
          <select
            id={`${id}-scope`}
            name="scope"
            value={scope}
            onChange={(e) => {
              setScope(e.currentTarget.value === "lobby" ? "lobby" : "global");
            }}
            className={selectClass}
          >
            {SCOPES.map((value) => (
              <option key={value} value={value}>
                {s.scopes[value]}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-room`} label={s.room}>
          <select
            id={`${id}-room`}
            name="room"
            defaultValue={search.room ?? ""}
            disabled={scope !== "global"}
            className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <option value="">{s.anyRoom}</option>
            {LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {roomName(locale)}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-q`} label={s.query} hint={s.queryHint}>
          <Input
            id={`${id}-q`}
            name="q"
            type="search"
            maxLength={100}
            defaultValue={search.query}
            aria-describedby={`${id}-q-hint`}
          />
        </Field>
        <Field id={`${id}-sender`} label={s.sender} hint={s.senderHint}>
          <Input
            id={`${id}-sender`}
            name="sender"
            maxLength={100}
            autoComplete="off"
            defaultValue={search.sender}
            aria-describedby={`${id}-sender-hint`}
          />
        </Field>
        <div className="flex flex-wrap gap-3 sm:col-span-2 lg:col-span-4">
          <Button type="submit">{s.search}</Button>
          <a href={paths.chat} className={`${linkClass} self-center`}>
            {s.clear}
          </a>
        </div>
      </form>

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
              void load();
            }}
          >
            {s.retry}
          </Button>
        </div>
      )}
      {state.status === "ready" &&
        (state.messages.length === 0 ? (
          <EmptyState icon={<MessageSquare />} title={s.empty} />
        ) : (
          <>
            <ol aria-label={s.results} className="grid gap-3">
              {state.messages.map((message) => (
                <li
                  key={`${message.kind}:${String(message.id)}`}
                  className="grid gap-2 rounded-2xl border border-border bg-surface p-4"
                >
                  <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted">
                    <a href={playerHref(message.sender_id)} className={linkClass}>
                      {message.nickname ?? players.noNickname}
                    </a>
                    <span>{where(message)}</span>
                    <time dateTime={message.created_at}>{dateTime(message.created_at, bcp47)}</time>
                    {message.status === "hidden" && <Badge variant="accent">{s.hidden}</Badge>}
                  </p>
                  <div className="grid gap-2">
                    <MessageBody body={message.body} gifId={message.gif_id} gifAlt={s.gif} />
                  </div>
                  <div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setOutcome(null);
                        setOpened((n) => n + 1);
                        setPending(message);
                      }}
                    >
                      {s.delete}
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
            {state.more && (
              <div>
                <Button variant="outline" disabled={loadingMore} onClick={() => void more()}>
                  {s.more}
                </Button>
              </div>
            )}
          </>
        ))}

      {pending !== null && (
        <ConfirmDialog
          key={opened}
          title={s.deleteTitle}
          body={s.deleteBody}
          confirm={s.delete}
          danger
          strings={players.act}
          onClose={() => {
            setPending(null);
          }}
          onConfirm={() => remove(pending)}
        />
      )}
    </div>
  );
}

function SlowMode({ supabase, bcp47, strings: s, players }: Props) {
  const id = useId();
  const [rooms, setRooms] = useState<Room[] | null | "failed">(null);
  const [chosen, setChosen] = useState<Partial<Record<Locale, number>>>({});
  const [busy, setBusy] = useState<Locale | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const roomName = roomNames(bcp47);

  const load = async () => {
    setRooms((await fetchRooms(supabase)) ?? "failed");
  };
  useEffect(() => {
    void fetchRooms(supabase).then((next) => {
      setRooms(next ?? "failed");
    });
  }, [supabase]);

  async function save(room: Room) {
    const seconds = chosen[room.locale] ?? room.slow_mode_seconds;
    setBusy(room.locale);
    setOutcome(null);
    const error = await setSlowMode(supabase, room.locale, seconds);
    await load();
    setBusy(null);
    setOutcome(
      error === null
        ? {
            ok: true,
            text: fill(s.slowSaved, {
              room: roomName(room.locale),
              value: slowModeLabel(seconds, s.slowOff, bcp47),
            }),
          }
        : { ok: false, text: errorText(error, players.act) },
    );
  }

  if (rooms === null)
    return (
      <p className="text-muted" aria-busy="true">
        {s.loading}
      </p>
    );
  if (rooms === "failed")
    return (
      <div className="grid justify-items-start gap-3">
        <p role="alert">{s.failed}</p>
        <Button variant="outline" onClick={() => void load()}>
          {s.retry}
        </Button>
      </div>
    );
  return (
    <div className="grid gap-3">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => {
          const value = chosen[room.locale] ?? room.slow_mode_seconds;
          const steps: readonly number[] = SLOW_MODE_STEPS.includes(
            room.slow_mode_seconds as (typeof SLOW_MODE_STEPS)[number],
          )
            ? SLOW_MODE_STEPS
            : [...SLOW_MODE_STEPS, room.slow_mode_seconds].sort((a, b) => a - b);
          return (
            <li
              key={room.locale}
              className="flex items-end gap-2 rounded-2xl border border-border bg-surface p-3"
            >
              <div className="min-w-0 flex-1">
                <Field id={`${id}-${room.locale}`} label={roomName(room.locale)}>
                  <select
                    id={`${id}-${room.locale}`}
                    value={value}
                    onChange={(e) => {
                      const next = Number(e.currentTarget.value);
                      setChosen((current) => ({ ...current, [room.locale]: next }));
                    }}
                    className={selectClass}
                  >
                    {steps.map((seconds) => (
                      <option key={seconds} value={seconds}>
                        {slowModeLabel(seconds, s.slowOff, bcp47)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Button
                variant="outline"
                disabled={busy !== null || value === room.slow_mode_seconds}
                aria-label={fill(s.slowSave, { room: roomName(room.locale) })}
                onClick={() => void save(room)}
              >
                {s.save}
              </Button>
            </li>
          );
        })}
      </ul>
      <p
        role="status"
        className={outcome?.ok === false ? "font-semibold text-danger" : "text-muted empty:hidden"}
      >
        {outcome?.text ?? ""}
      </p>
    </div>
  );
}

function Muted({ supabase, bcp47, paths, strings: s, players }: Props) {
  const [mutes, setMutes] = useState<Mute[] | null | "failed">(null);
  const [pending, setPending] = useState<Mute | null>(null);
  const [opened, setOpened] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const playerHref = playerPage(paths);

  const load = async () => {
    setMutes((await fetchMutes(supabase)) ?? "failed");
  };
  useEffect(() => {
    void fetchMutes(supabase).then((next) => {
      setMutes(next ?? "failed");
    });
  }, [supabase]);

  async function revoke(mute: Mute) {
    const error = await revokeMute(supabase, mute);
    await load();
    setPending(null);
    setOutcome(
      error === null
        ? { ok: true, text: s.done }
        : { ok: false, text: errorText(error, players.act) },
    );
  }

  return (
    <div className="grid gap-3">
      <p
        role="status"
        className={outcome?.ok === false ? "font-semibold text-danger" : "text-muted empty:hidden"}
      >
        {outcome?.text ?? ""}
      </p>
      {mutes === null && (
        <p className="text-muted" aria-busy="true">
          {s.loading}
        </p>
      )}
      {mutes === "failed" && (
        <div className="grid justify-items-start gap-3">
          <p role="alert">{s.failed}</p>
          <Button variant="outline" onClick={() => void load()}>
            {s.retry}
          </Button>
        </div>
      )}
      {Array.isArray(mutes) &&
        (mutes.length === 0 ? (
          <EmptyState icon={<MicOff />} title={s.mutedEmpty} />
        ) : (
          <ul className="grid gap-3">
            {mutes.map((mute) => (
              <li
                key={mute.sanction_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4"
              >
                <div className="grid min-w-0 gap-1">
                  <a href={playerHref(mute.user_id)} className={`${linkClass} justify-self-start`}>
                    {mute.nickname ?? players.noNickname}
                  </a>
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    <span>{players.reasons[mute.reason] ?? mute.reason}</span>
                    <span>
                      {mute.ends_at === null
                        ? s.noEnd
                        : fill(s.endsAt, { date: dateTime(mute.ends_at, bcp47) })}
                    </span>
                    <span>
                      {players.by}{" "}
                      {mute.created_by === null
                        ? players.automatic
                        : (mute.created_by_nickname ?? players.noNickname)}
                    </span>
                  </p>
                  {mute.note !== null && (
                    <p className="text-sm break-words" dir="auto">
                      {mute.note}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  aria-label={fill(s.unmute, { name: mute.nickname ?? players.noNickname })}
                  onClick={() => {
                    setOutcome(null);
                    setOpened((n) => n + 1);
                    setPending(mute);
                  }}
                >
                  {players.act.revoke}
                </Button>
              </li>
            ))}
          </ul>
        ))}
      {pending !== null && (
        <ConfirmDialog
          key={opened}
          title={players.act.revokeTitle}
          body={s.unmuteBody}
          confirm={players.act.revoke}
          danger={false}
          strings={players.act}
          onClose={() => {
            setPending(null);
          }}
          onConfirm={() => revoke(pending)}
        />
      )}
    </div>
  );
}
