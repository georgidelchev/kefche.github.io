// Global chat (SPEC §8.2), for accounts: one room per language, the page's
// by default and any other a pick away (`?room=bg`). The latest messages,
// earlier ones a page at a time, new ones live. Players delete their own
// messages; moderators delete any and mute from the chat. The database
// masks blocked words, limits the pace, applies slow mode and refuses new
// accounts for their first 2 hours, muted players and guests.
import { Trash2, VolumeX } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { UserAvatar } from "@kefche/ui/components/avatar";
import { Button } from "@kefche/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kefche/ui/components/dialog";
import { Input } from "@kefche/ui/components/input";
import { isAvatarFrame } from "@kefche/ui/lib/frames";

import { avatarUrl } from "@/features/account/avatar-url";
import { fill } from "@/features/games/turn/labels";
import { refusalEnd, sanctionNotice } from "@/features/moderation/sanction-notice";
import { useAccount } from "@/features/settings/use-account";
import { supabaseConfig } from "@/lib/supabase/config";

import {
  fetchHistory,
  mergeMessages,
  PAGE,
  sendMessage,
  watchRoom,
  type ChatMessage,
  type Sender,
} from "./chat-data";

import type { ChatPageStrings } from "./strings";

const MAX_LENGTH = 500;
/** Mute lengths offered to moderators, in minutes. */
const MUTES = [
  ["m10", 10],
  ["h1", 60],
  ["h24", 1440],
  ["d7", 10080],
] as const;
const MUTE_REASONS = ["spam", "harassment", "hate", "sexual", "self-harm", "other"] as const;

interface Props {
  strings: ChatPageStrings;
  /** Every room, by locale code, named in its own language. */
  rooms: { code: string; name: string }[];
  /** The page's locale: the room shown by default. */
  initialRoom: string;
  bcp47: string;
  signInPath: string;
  /** "/<locale>/u/" */
  profileBase: string;
}

function roomFromUrl(rooms: Props["rooms"], fallback: string): string {
  if (typeof location === "undefined") return fallback;
  const asked = new URLSearchParams(location.search).get("room");
  return rooms.find((r) => r.code === asked)?.code ?? fallback;
}

export function ChatPage({
  strings: s,
  rooms,
  initialRoom,
  bcp47,
  signInPath,
  profileBase,
}: Props) {
  const account = useAccount(signInPath);
  const id = useId();
  const [room, setRoom] = useState(() => roomFromUrl(rooms, initialRoom));
  const [messages, setMessages] = useState<ChatMessage[] | null | undefined>(undefined);
  const [earlier, setEarlier] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [slow, setSlow] = useState(0);
  const [staff, setStaff] = useState(false);
  const [muting, setMuting] = useState<Sender | null>(null);
  const logRef = useRef<HTMLOListElement>(null);
  const stickRef = useRef(true);
  const sendingRef = useRef(false);

  // The room: its history and new messages, live; its slow mode.
  useEffect(() => {
    if (account.status !== "ready") return;
    const { supabase } = account;
    void supabase
      .from("chat_rooms")
      .select("slow_mode_seconds")
      .eq("locale", room)
      .maybeSingle()
      .then(({ data }) => {
        setSlow(data?.slow_mode_seconds ?? 0);
      });
    return watchRoom(supabase, room, {
      onLoad: (latest) => {
        setMessages((current) => mergeMessages(current ?? [], latest));
        setEarlier(latest.length >= PAGE);
      },
      onMessage: (message) => {
        setMessages((current) => (current ? mergeMessages(current, [message]) : current));
      },
      onDeleted: (deleted) => {
        setMessages((current) => current?.filter((m) => m.id !== deleted));
      },
      onError: () => {
        setMessages((current) => current ?? null);
      },
    });
  }, [account, room]);

  // Moderators get their tools.
  useEffect(() => {
    if (account.status !== "ready") return;
    void account.supabase.rpc("is_staff").then(({ data }) => {
      setStaff(data === true);
    });
  }, [account]);

  // Stays at the newest message unless the reader scrolled up.
  useLayoutEffect(() => {
    const log = logRef.current;
    if (log && stickRef.current) log.scrollTop = log.scrollHeight;
  }, [messages]);

  if (account.status === "error" || messages === null) {
    return (
      <div className="grid justify-items-start gap-3">
        <p role="alert">{s.failed}</p>
        <Button
          variant="outline"
          onClick={() => {
            location.reload();
          }}
        >
          {s.retry}
        </Button>
      </div>
    );
  }
  if (account.status !== "ready") {
    return (
      <p className="min-h-32 text-muted" aria-busy="true">
        {s.loading}
      </p>
    );
  }
  const { supabase, user } = account;

  function pick(next: string) {
    if (next === room) return;
    const url = new URL(location.href);
    url.searchParams.set("room", next);
    history.replaceState(history.state, "", url);
    stickRef.current = true;
    setMessages(undefined);
    setError(null);
    setRoom(next);
  }

  async function loadEarlier() {
    const first = messages?.[0];
    if (!first) return;
    const log = logRef.current;
    const height = log?.scrollHeight ?? 0;
    const older = await fetchHistory(supabase, room, first.id);
    if (!older) return;
    stickRef.current = false;
    setEarlier(older.length >= PAGE);
    setMessages((current) => [...older, ...(current ?? [])]);
    // Keep the reader where they were.
    requestAnimationFrame(() => {
      if (log) log.scrollTop += log.scrollHeight - height;
    });
  }

  async function send() {
    const body = text.trim();
    if (body === "" || sendingRef.current) return;
    sendingRef.current = true;
    setError(null);
    const result = await sendMessage(supabase, room, body);
    sendingRef.current = false;
    if ("message" in result) {
      setText("");
      stickRef.current = true;
      setMessages((current) => (current ? mergeMessages(current, [result.message]) : current));
      return;
    }
    setError(errorText(result.error, s, bcp47));
  }

  async function remove(message: ChatMessage) {
    const { error: rpcError } = await supabase.rpc("delete_chat_message", {
      p_message: message.id,
    });
    if (rpcError) setError(s.errors.failed);
    else setMessages((current) => current?.filter((m) => m.id !== message.id));
  }

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(bcp47, { hour: "numeric", minute: "2-digit" });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-room`} className="text-sm font-semibold">
            {s.room}
          </label>
          <select
            id={`${id}-room`}
            value={room}
            onChange={(e) => {
              pick(e.currentTarget.value);
            }}
            className="min-h-11 cursor-pointer rounded-xl border border-border-strong bg-surface-2 px-3 text-base text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {rooms.map((r) => (
              <option key={r.code} value={r.code} lang={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        {slow > 0 && (
          <p className="text-sm text-muted">
            {fill(s.slowMode, { seconds: slow.toLocaleString(bcp47) })}
          </p>
        )}
      </div>

      <div className="grid rounded-2xl border border-border bg-surface">
        <ol
          ref={logRef}
          aria-label={s.title}
          aria-live="polite"
          aria-busy={messages === undefined}
          lang={room}
          onScroll={(e) => {
            const log = e.currentTarget;
            stickRef.current = log.scrollHeight - log.scrollTop - log.clientHeight < 48;
          }}
          className="grid h-[min(32rem,calc(100dvh-22rem))] min-h-64 content-start gap-1 overflow-y-auto overscroll-contain p-3"
        >
          {messages === undefined ? (
            <li className="p-2 text-muted">{s.loading}</li>
          ) : (
            <>
              {earlier && (
                <li className="justify-self-center">
                  <Button variant="ghost" onClick={() => void loadEarlier()}>
                    {s.earlier}
                  </Button>
                </li>
              )}
              {messages.length === 0 && <li className="p-2 text-muted">{s.empty}</li>}
              {messages.map((m) => {
                const mine = m.sender?.id === user.id;
                const sender = m.sender;
                return (
                  <li
                    key={m.id}
                    className="group flex items-start gap-2 rounded-xl p-1.5 hover:bg-surface-2"
                  >
                    <SenderAvatar sender={sender} />
                    <div className="grid min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                        {sender ? (
                          <a
                            href={`${profileBase}${encodeURIComponent(sender.nickname)}/`}
                            className="font-semibold hover:underline"
                            lang=""
                          >
                            {sender.nickname}
                          </a>
                        ) : (
                          <span className="font-semibold">?</span>
                        )}
                        <time dateTime={m.at} className="text-xs text-muted">
                          {time(m.at)}
                        </time>
                      </p>
                      <p className="break-words whitespace-pre-wrap">{m.body}</p>
                    </div>
                    {(mine || staff) && (
                      <span className="flex shrink-0 gap-1">
                        {staff && !mine && sender && (
                          <IconButton
                            label={fill(s.actions.mute, { name: sender.nickname })}
                            onClick={() => {
                              setMuting(sender);
                            }}
                          >
                            <VolumeX aria-hidden="true" className="size-4" />
                          </IconButton>
                        )}
                        <IconButton label={s.actions.delete} onClick={() => void remove(m)}>
                          <Trash2 aria-hidden="true" className="size-4" />
                        </IconButton>
                      </span>
                    )}
                  </li>
                );
              })}
            </>
          )}
        </ol>

        <form
          className="flex gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label htmlFor={`${id}-message`} className="sr-only">
            {s.label}
          </label>
          <Input
            id={`${id}-message`}
            value={text}
            maxLength={MAX_LENGTH}
            autoComplete="off"
            enterKeyHint="send"
            lang={room}
            onChange={(e) => {
              setText(e.target.value);
            }}
            className="min-w-0 flex-1"
          />
          <Button type="submit" disabled={text.trim() === ""}>
            {s.send}
          </Button>
        </form>
      </div>
      <p role="alert" className="text-sm font-semibold text-danger empty:hidden">
        {error ?? ""}
      </p>
      <p role="status" className="text-sm font-semibold text-success empty:hidden">
        {notice ?? ""}
      </p>

      <MuteDialog
        sender={muting}
        strings={s}
        onClose={() => {
          setMuting(null);
        }}
        onMute={async (sender, minutes, reason) => {
          setMuting(null);
          const { error: rpcError } = await supabase.rpc("sanction_player", {
            p_user: sender.id,
            p_kind: "mute",
            p_reason: reason,
            p_minutes: minutes,
          });
          if (rpcError) setError(s.errors.failed);
          else setNotice(fill(s.actions.muted, { name: sender.nickname }));
        }}
      />
    </div>
  );
}

/** How a refused message reads. */
function errorText(error: unknown, s: ChatPageStrings, bcp47: string): string {
  const message = (error as { message?: unknown } | null)?.message;
  const muted = refusalEnd(error, "muted");
  if (muted !== undefined) {
    return sanctionNotice(muted, { until: s.errors.mutedUntil, forever: s.errors.muted }, bcp47);
  }
  const tooNew = refusalEnd(error, "too_new");
  if (tooNew) return sanctionNotice(tooNew, { until: s.errors.tooNewUntil, forever: "" }, bcp47);
  const slow = refusalEnd(error, "slow_mode");
  if (slow) {
    return fill(s.errors.slowUntil, {
      until: slow.toLocaleTimeString(bcp47, {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      }),
    });
  }
  if (message === "rate_limited") return s.errors.tooFast;
  if (message === "invalid_message") return s.errors.tooLong;
  return s.errors.failed;
}

function SenderAvatar({ sender }: { sender: Sender | null }) {
  if (!sender) return <span className="size-8 shrink-0 rounded-full bg-surface-2" />;
  const image = supabaseConfig
    ? avatarUrl(
        {
          avatar_kind: sender.avatarKind,
          avatar_preset: sender.avatarPreset,
          avatar_path: sender.avatarPath,
        },
        supabaseConfig.url,
      )
    : null;
  return (
    <UserAvatar
      name={sender.nickname}
      id={sender.id}
      size="sm"
      {...(image ? { src: image } : {})}
      frame={isAvatarFrame(sender.avatarFrame) ? sender.avatarFrame : null}
    />
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-focus"
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function MuteDialog({
  sender,
  strings: s,
  onClose,
  onMute,
}: {
  sender: Sender | null;
  strings: ChatPageStrings;
  onClose: () => void;
  onMute: (sender: Sender, minutes: number, reason: string) => Promise<void>;
}) {
  const id = useId();
  const [minutes, setMinutes] = useState<number>(MUTES[0][1]);
  const [reason, setReason] = useState<string>(MUTE_REASONS[0]);
  const select =
    "min-h-11 w-full cursor-pointer rounded-xl border border-border-strong bg-surface-2 px-3 text-base text-text";
  return (
    <Dialog
      open={sender !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {sender && (
        <DialogContent closeLabel={s.actions.close}>
          <DialogHeader>
            <DialogTitle>{fill(s.actions.muteTitle, { name: sender.nickname })}</DialogTitle>
            <DialogDescription className="sr-only">
              {fill(s.actions.mute, { name: sender.nickname })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label htmlFor={`${id}-minutes`} className="grid gap-1.5 font-semibold">
              {s.actions.duration}
              <select
                id={`${id}-minutes`}
                className={select}
                value={minutes}
                onChange={(e) => {
                  setMinutes(Number(e.currentTarget.value));
                }}
              >
                {MUTES.map(([key, value]) => (
                  <option key={key} value={value}>
                    {s.actions.durations[key]}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={`${id}-reason`} className="grid gap-1.5 font-semibold">
              {s.actions.reason}
              <select
                id={`${id}-reason`}
                className={select}
                value={reason}
                onChange={(e) => {
                  setReason(e.currentTarget.value);
                }}
              >
                {MUTE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {s.reasons[r === "self-harm" ? "selfHarm" : r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {s.actions.cancel}
            </Button>
            <Button variant="danger" onClick={() => void onMute(sender, minutes, reason)}>
              {s.actions.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
