// Direct messages (SPEC §8.2): conversations, latest first with unread
// counts, beside the open thread (one or the other on phones). A thread is
// the one with `?with=<player id>`, from a profile, the friends list or a
// notification; the first message starts the conversation. Messages,
// deletions, "seen" and typing arrive live on the player's own channel.
// The other player's messages can be reported. The database decides who may write (blocks, privacy, new accounts, mutes).
import { ArrowLeft, Flag, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { UserAvatar } from "@kefche/ui/components/avatar";
import { Button } from "@kefche/ui/components/button";
import { Input } from "@kefche/ui/components/input";
import { isAvatarFrame } from "@kefche/ui/lib/frames";

import { avatarUrl } from "@/features/account/avatar-url";
import { insertText } from "@/features/chat/compose";
import { EmojiButton } from "@/features/chat/EmojiButton";
import { GifButton } from "@/features/chat/GifButton";
import { MessageBody } from "@/features/chat/MessageBody";
import type { ChatToolsStrings } from "@/features/chat/strings";
import { fill } from "@/features/games/turn/labels";
import { LIVE_RESUME_EVENT, UNREAD_EVENT } from "@/features/live/presence-context";
import { ReportDialog, type ReportTarget } from "@/features/moderation/ReportDialog";
import { refusalEnd, sanctionNotice } from "@/features/moderation/sanction-notice";
import { useAccount } from "@/features/settings/use-account";
import { send, type Supabase } from "@/lib/supabase/client";
import { supabaseConfig } from "@/lib/supabase/config";

import {
  fetchConversations,
  fetchThread,
  mergeDms,
  onLiveDm,
  PAGE,
  PLAYER_ID,
  sendDm,
  type Conversation,
  type Player,
  type Thread,
} from "./dm-data";

import type { MessagesPageStrings } from "./strings";

const MAX_LENGTH = 500;
/** How long "is typing" shows after the last signal. */
const TYPING_MS = 4000;
/** Typing signals go out at most this often. */
const TYPING_EVERY_MS = 3000;

interface Props {
  strings: MessagesPageStrings;
  bcp47: string;
  signInPath: string;
  /** "/<locale>/u/" */
  profileBase: string;
  guidelinesPath: string;
  tools: ChatToolsStrings;
  /** The GIF button (builds with GIFs on). */
  gifs: boolean;
  dir: "ltr" | "rtl";
}

function withFromUrl(): string | null {
  if (typeof location === "undefined") return null;
  const asked = new URLSearchParams(location.search).get("with") ?? "";
  return PLAYER_ID.test(asked) ? asked.toLowerCase() : null;
}

export function MessagesPage({
  strings: s,
  bcp47,
  signInPath,
  profileBase,
  guidelinesPath,
  tools,
  gifs,
  dir,
}: Props) {
  const account = useAccount(signInPath);
  const [list, setList] = useState<Conversation[] | null | undefined>(undefined);
  const [withId, setWithId] = useState<string | null>(withFromUrl);

  const supabase = account.status === "ready" ? account.supabase : null;
  const refresh = useCallback(() => {
    if (supabase) void fetchConversations(supabase).then(setList);
  }, [supabase]);

  // The list, again whenever a message comes or goes, or the tab comes back.
  useEffect(() => {
    refresh();
    const stop = onLiveDm((event) => {
      if (event.kind === "message" || event.kind === "deleted") refresh();
    });
    document.addEventListener(LIVE_RESUME_EVENT, refresh);
    return () => {
      stop();
      document.removeEventListener(LIVE_RESUME_EVENT, refresh);
    };
  }, [refresh]);

  if (account.status === "error" || list === null) {
    return (
      <div className="grid justify-items-start gap-3">
        <p role="alert">{s.failed}</p>
        <Button variant="outline" onClick={refresh}>
          {s.retry}
        </Button>
      </div>
    );
  }
  if (account.status !== "ready" || list === undefined) {
    return (
      <p className="min-h-32 text-muted" aria-busy="true">
        {s.loading}
      </p>
    );
  }

  const open = (id: string | null) => {
    const url = new URL(location.href);
    if (id) url.searchParams.set("with", id);
    else url.searchParams.delete("with");
    history.replaceState(history.state, "", url);
    setWithId(id);
  };

  return (
    <div className="grid gap-4 md:grid-cols-[18rem_1fr] md:items-start">
      <section
        aria-label={s.conversations}
        className={withId ? "hidden md:grid md:gap-2" : "grid gap-2"}
      >
        {list.length === 0 ? (
          <div className="grid gap-1 rounded-2xl border border-dashed border-border p-6 text-center">
            <p className="font-semibold">{s.empty}</p>
            <p className="text-sm text-muted">{s.emptyHint}</p>
          </div>
        ) : (
          <ul className="grid gap-1">
            {list.map((c) => (
              <li key={c.with.id}>
                <a
                  href={`?with=${c.with.id}`}
                  aria-current={c.with.id === withId ? "true" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    open(c.with.id);
                  }}
                  className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus aria-[current=true]:bg-surface-2"
                >
                  <Avatar player={c.with} />
                  <span className="grid min-w-0 flex-1">
                    <span className={`truncate ${c.unread > 0 ? "font-bold" : "font-semibold"}`}>
                      {c.with.nickname}
                    </span>
                    <span className="truncate text-sm text-muted">
                      {c.last === null
                        ? ""
                        : c.last.status === "deleted"
                          ? s.deleted
                          : c.last.senderId === account.user.id
                            ? fill(s.you, { text: c.last.body ?? tools.gifAlt })
                            : (c.last.body ?? tools.gifAlt)}
                    </span>
                  </span>
                  {c.unread > 0 && (
                    <span className="rounded-full bg-brand px-2 text-xs font-bold text-on-brand">
                      {c.unread.toLocaleString(bcp47)}
                      <span className="sr-only">
                        {" "}
                        {fill(s.unread, { count: c.unread.toLocaleString(bcp47) })}
                      </span>
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {withId ? (
        <ThreadView
          key={withId}
          supabase={account.supabase}
          me={account.user.id}
          withId={withId}
          strings={s}
          bcp47={bcp47}
          profileBase={profileBase}
          guidelinesPath={guidelinesPath}
          tools={tools}
          gifs={gifs}
          dir={dir}
          onChanged={refresh}
          onBack={() => {
            open(null);
          }}
        />
      ) : (
        <p className="hidden text-muted md:block">{s.pick}</p>
      )}
    </div>
  );
}

function ThreadView({
  supabase,
  me,
  withId,
  strings: s,
  bcp47,
  profileBase,
  guidelinesPath,
  tools,
  gifs,
  dir,
  onChanged,
  onBack,
}: {
  supabase: Supabase;
  me: string;
  withId: string;
  strings: MessagesPageStrings;
  bcp47: string;
  profileBase: string;
  guidelinesPath: string;
  tools: ChatToolsStrings;
  gifs: boolean;
  dir: "ltr" | "rtl";
  onChanged: () => void;
  onBack: () => void;
}) {
  const id = useId();
  const [thread, setThread] = useState<Thread | null | undefined>(undefined);
  const [reporting, setReporting] = useState<ReportTarget | null>(null);
  const [earlier, setEarlier] = useState(false);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLOListElement>(null);
  const stickRef = useRef(true);
  const sendingRef = useRef(false);
  const typedRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const readNow = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    void supabase.rpc("read_direct_messages", { p_user: withId }).then(({ data }) => {
      if (typeof data === "number") {
        document.dispatchEvent(new CustomEvent(UNREAD_EVENT, { detail: { count: data } }));
      }
      onChanged();
    });
  }, [supabase, withId, onChanged]);

  // The thread, read on load and when the tab comes back; then live.
  useEffect(() => {
    const load = () => {
      void fetchThread(supabase, withId, null).then((next) => {
        setThread((current) =>
          next && current ? { ...next, messages: mergeDms(current.messages, next.messages) } : next,
        );
        setEarlier((next?.messages.length ?? 0) >= PAGE);
        if (next && next.messages.length > 0) readNow();
      });
    };
    load();
    let typingTimer: ReturnType<typeof setTimeout> | undefined;
    const stop = onLiveDm((event) => {
      if (event.kind === "typing") {
        if (event.from !== withId) return;
        setTyping(true);
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          setTyping(false);
        }, TYPING_MS);
        return;
      }
      if (event.kind === "read") {
        if (event.from === withId) {
          setThread((t) => (t ? { ...t, otherRead: Math.max(t.otherRead, event.read) } : t));
        }
        return;
      }
      const ours =
        (event.from === withId && event.to === me) || (event.from === me && event.to === withId);
      if (!ours) return;
      if (event.kind === "message") {
        setThread((t) => (t ? { ...t, messages: mergeDms(t.messages, [event.message]) } : t));
        if (event.from === withId) {
          setTyping(false);
          readNow();
        }
      } else {
        setThread((t) =>
          t
            ? {
                ...t,
                messages: t.messages.map((m) =>
                  m.id === event.id ? { ...m, status: "deleted", body: null } : m,
                ),
              }
            : t,
        );
      }
    });
    const visible = () => {
      if (document.visibilityState === "visible") readNow();
    };
    document.addEventListener("visibilitychange", visible);
    document.addEventListener(LIVE_RESUME_EVENT, load);
    return () => {
      stop();
      clearTimeout(typingTimer);
      document.removeEventListener("visibilitychange", visible);
      document.removeEventListener(LIVE_RESUME_EVENT, load);
    };
  }, [supabase, withId, me, readNow]);

  useLayoutEffect(() => {
    const log = logRef.current;
    if (log && stickRef.current) log.scrollTop = log.scrollHeight;
  }, [thread, typing]);

  if (thread === null) {
    return (
      <div className="grid justify-items-start gap-3">
        <BackButton label={s.back} onClick={onBack} />
        <p role="alert">{s.failed}</p>
      </div>
    );
  }
  if (thread === undefined) {
    return (
      <p className="text-muted" aria-busy="true">
        {s.loading}
      </p>
    );
  }
  const other = thread.with;
  const lastMine = thread.messages.findLast((m) => m.senderId === me);

  async function loadEarlier() {
    const first = thread?.messages[0];
    if (!first) return;
    const log = logRef.current;
    const height = log?.scrollHeight ?? 0;
    const older = await fetchThread(supabase, withId, first.id);
    if (!older) return;
    stickRef.current = false;
    setEarlier(older.messages.length >= PAGE);
    setThread((t) => (t ? { ...t, messages: mergeDms(t.messages, older.messages) } : t));
    requestAnimationFrame(() => {
      if (log) log.scrollTop += log.scrollHeight - height;
    });
  }

  async function submit(gif?: string) {
    const body = text.trim();
    if ((body === "" && !gif) || sendingRef.current) return;
    sendingRef.current = true;
    setError(null);
    // A GIF goes on its own; the text being written stays.
    const result = await sendDm(supabase, withId, gif ? "" : body, gif);
    sendingRef.current = false;
    if ("message" in result) {
      if (!gif) setText("");
      stickRef.current = true;
      setThread((t) => (t ? { ...t, messages: mergeDms(t.messages, [result.message]) } : t));
      onChanged();
      return;
    }
    setError(errorText(result.error, s, tools, bcp47));
  }

  async function remove(messageId: number) {
    const { error: rpcError } = await supabase.rpc("delete_direct_message", {
      p_message: messageId,
    });
    if (rpcError) setError(s.errors.failed);
  }

  const time = (iso: string) =>
    new Date(iso).toLocaleString(bcp47, {
      dateStyle: "short",
      timeStyle: "short",
    });

  return (
    <section aria-labelledby={`${id}-with`} className="grid gap-3">
      <div className="flex items-center gap-3">
        <span className="md:hidden">
          <BackButton label={s.back} onClick={onBack} />
        </span>
        <Avatar player={other} />
        <h2 id={`${id}-with`} className="min-w-0 truncate text-xl">
          <a
            href={`${profileBase}${encodeURIComponent(other.nickname)}/`}
            className="hover:underline"
          >
            {other.nickname}
          </a>
        </h2>
      </div>

      <div className="grid rounded-2xl border border-border bg-surface">
        <ol
          ref={logRef}
          aria-label={other.nickname}
          aria-live="polite"
          onScroll={(e) => {
            const log = e.currentTarget;
            stickRef.current = log.scrollHeight - log.scrollTop - log.clientHeight < 48;
          }}
          className="grid h-[min(32rem,calc(100dvh-20rem))] min-h-64 content-start gap-2 overflow-y-auto overscroll-contain p-3"
        >
          {earlier && (
            <li className="justify-self-center">
              <Button variant="ghost" onClick={() => void loadEarlier()}>
                {s.earlier}
              </Button>
            </li>
          )}
          {thread.messages.length === 0 && (
            <li className="p-2 text-muted">{fill(s.start, { name: other.nickname })}</li>
          )}
          {thread.messages.map((m) => {
            const mine = m.senderId === me;
            const deleted = m.status === "deleted";
            return (
              <li
                key={m.id}
                className={`group grid max-w-[85%] gap-0.5 ${mine ? "justify-items-end justify-self-end" : "justify-self-start"}`}
              >
                <div className="flex items-center gap-1">
                  {mine && !deleted && (
                    <button
                      type="button"
                      title={s.delete}
                      onClick={() => void remove(m.id)}
                      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted opacity-60 hover:bg-surface-2 hover:text-text hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                      <span className="sr-only">{s.delete}</span>
                    </button>
                  )}
                  {!mine && !deleted && (
                    <button
                      type="button"
                      title={s.report.message}
                      onClick={() => {
                        setReporting({ type: "message", id: String(m.id), name: other.nickname });
                      }}
                      className="order-last inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted opacity-60 hover:bg-surface-2 hover:text-text hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      <Flag aria-hidden="true" className="size-4" />
                      <span className="sr-only">{s.report.message}</span>
                    </button>
                  )}
                  <p
                    className={`rounded-2xl px-3 py-2 break-words whitespace-pre-wrap ${
                      deleted
                        ? "border border-dashed border-border text-sm text-muted italic"
                        : mine
                          ? "bg-brand text-on-brand"
                          : "bg-surface-2"
                    }`}
                  >
                    {deleted ? (
                      s.deleted
                    ) : (
                      <MessageBody body={m.body} gifId={m.gifId ?? null} gifAlt={tools.gifAlt} />
                    )}
                  </p>
                </div>
                <span className="text-xs text-muted">
                  <time dateTime={m.at}>{time(m.at)}</time>
                  {m.id === lastMine?.id && thread.otherRead >= m.id && ` · ${s.seen}`}
                </span>
              </li>
            );
          })}
          {typing && (
            <li className="text-sm text-muted italic">
              {fill(s.typing, { name: other.nickname })}
            </li>
          )}
        </ol>

        {thread.canWrite ? (
          <form
            className="flex gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label htmlFor={`${id}-message`} className="sr-only">
              {s.label}
            </label>
            <EmojiButton
              strings={tools}
              dir={dir}
              onPick={(emoji) => {
                const next = insertText(inputRef.current, text, emoji, MAX_LENGTH);
                if (!next) return;
                setText(next.value);
                requestAnimationFrame(() => {
                  inputRef.current?.focus();
                  inputRef.current?.setSelectionRange(next.caret, next.caret);
                });
              }}
            />
            {gifs && (
              <GifButton
                supabase={supabase}
                strings={tools}
                dir={dir}
                onPick={(gif) => void submit(gif)}
              />
            )}
            <Input
              ref={inputRef}
              id={`${id}-message`}
              value={text}
              maxLength={MAX_LENGTH}
              autoComplete="off"
              enterKeyHint="send"
              onChange={(e) => {
                setText(e.target.value);
                const now = Date.now();
                if (e.target.value !== "" && now - typedRef.current > TYPING_EVERY_MS) {
                  typedRef.current = now;
                  send(supabase.rpc("direct_typing", { p_user: withId }));
                }
              }}
              className="min-w-0 flex-1"
            />
            <Button type="submit" disabled={text.trim() === ""}>
              {s.send}
            </Button>
          </form>
        ) : (
          <p className="border-t border-border p-3 text-sm text-muted">{s.cantWrite}</p>
        )}
      </div>
      <p role="alert" className="text-sm font-semibold text-danger empty:hidden">
        {error ?? ""}
      </p>
      <p className="text-sm">
        <a
          href={guidelinesPath}
          className="font-semibold text-link underline-offset-4 hover:underline"
        >
          {s.report.guidelines}
        </a>
      </p>
      <ReportDialog
        target={reporting}
        supabase={supabase}
        strings={s.report}
        guidelinesPath={guidelinesPath}
        onClose={() => {
          setReporting(null);
        }}
      />
    </section>
  );
}

/** How a refused message reads. */
function errorText(
  error: unknown,
  s: MessagesPageStrings,
  tools: ChatToolsStrings,
  bcp47: string,
): string {
  const message = (error as { message?: unknown } | null)?.message;
  const muted = refusalEnd(error, "muted");
  if (muted !== undefined) {
    return sanctionNotice(muted, { until: s.errors.mutedUntil, forever: s.errors.muted }, bcp47);
  }
  const tooNew = refusalEnd(error, "too_new");
  if (tooNew) return sanctionNotice(tooNew, { until: s.errors.tooNewUntil, forever: "" }, bcp47);
  if (message === "unavailable") return s.errors.unavailable;
  if (message === "invalid_gif") return tools.gifInvalid;
  if (message === "rate_limited") return s.errors.tooFast;
  if (message === "invalid_message") return s.errors.tooLong;
  return s.errors.failed;
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" onClick={onClick}>
      <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
      {label}
    </Button>
  );
}

function Avatar({ player }: { player: Player }) {
  const image = supabaseConfig
    ? avatarUrl(
        {
          avatar_kind: player.avatarKind,
          avatar_preset: player.avatarPreset,
          avatar_path: player.avatarPath,
        },
        supabaseConfig.url,
      )
    : null;
  return (
    <UserAvatar
      name={player.nickname}
      id={player.id}
      size="sm"
      {...(image ? { src: image } : {})}
      frame={isAvatarFrame(player.avatarFrame) ? player.avatarFrame : null}
    />
  );
}
