// The lobby's chat (SPEC §6.4, §8.2): the room's latest messages, live, and
// a line to write one, for everyone in the room. The database masks blocked
// words, limits how fast anyone can send, and refuses a muted player.
// Players delete their own messages and report others'; moderators delete
// any and mute. What 3 accounts report is hidden (its sender sees a note).
//
// In the lobby it is a fixed pane of the room page, and the room scrolls
// beside it: a column on the right from 768px, a band along the bottom on
// phones. It folds into a strip (a bar on phones) that counts new messages.
// It starts open; the choice is remembered in this browser.
//
// During a match (`layout="drawer"`) it is a button in the match's bar,
// counting new messages, that opens the chat over the board: a drawer on the
// side from 768px, a sheet from the bottom on phones. It starts closed, and
// Escape closes it.
import {
  ChevronDown,
  ChevronUp,
  Flag,
  MessageSquare,
  PanelRightClose,
  Trash2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useEffectEvent, useId, useRef, useState, type ReactNode } from "react";

import { Button } from "@kefche/ui/components/button";
import { Input } from "@kefche/ui/components/input";

import { insertText } from "@/features/chat/compose";
import { EmojiButton } from "@/features/chat/EmojiButton";
import { MessageBody } from "@/features/chat/MessageBody";
import { fill } from "@/features/games/turn/labels";
import { MuteDialog, mutePlayer } from "@/features/moderation/MuteDialog";
import { ReportDialog, type ReportTarget } from "@/features/moderation/ReportDialog";
import { sanctionEnd, sanctionNotice } from "@/features/moderation/sanction-notice";
import type { Supabase } from "@/lib/supabase/client";

import { chatMessage, mergeMessages, watchChat, type ChatMessage } from "./room-chat";

import type { ChatStrings } from "./strings";

const MAX_LENGTH = 300;
const OPEN_KEY = "kefche:chat-open";

function initiallyOpen(): boolean {
  try {
    const saved = localStorage.getItem(OPEN_KEY);
    if (saved !== null) return saved === "1";
  } catch {
    // Storage blocked: open.
  }
  return true;
}

interface Props {
  supabase: Supabase;
  roomId: string;
  self: string;
  locale: string;
  strings: ChatStrings;
  dir: "ltr" | "rtl";
  /** `pane` (default): the lobby's side pane. `drawer`: a button that opens it over a match. */
  layout?: "pane" | "drawer";
}

export function RoomChat({
  supabase,
  roomId,
  self,
  locale,
  strings: s,
  dir,
  layout = "pane",
}: Props) {
  const id = useId();
  const drawer = layout === "drawer";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [staff, setStaff] = useState(false);
  const [reporting, setReporting] = useState<ReportTarget | null>(null);
  const [muting, setMuting] = useState<{ id: string; nickname: string } | null>(null);
  const [open, setOpen] = useState(() => !drawer && initiallyOpen());
  const toggleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // The newest message id the reader has seen; null until the chat loads.
  const [seen, setSeen] = useState<number | null>(null);
  const logRef = useRef<HTMLOListElement>(null);
  const sendingRef = useRef(false);

  useEffect(
    () =>
      watchChat(
        supabase,
        roomId,
        (added) => {
          setMessages((current) => mergeMessages(current, added));
          // What was there on arrival counts as read.
          setSeen((current) => current ?? Math.max(0, ...added.map((m) => m.id)));
        },
        (removed, hidden) => {
          // A hidden message stays for its sender, marked.
          setMessages((current) =>
            current.flatMap((m) =>
              m.id !== removed ? [m] : hidden && m.userId === self ? [{ ...m, hidden: true }] : [],
            ),
          );
        },
        () => {
          setError(s.failed);
        },
      ),
    [supabase, roomId, self, s],
  );

  // Moderators get their tools.
  useEffect(() => {
    void supabase.rpc("is_staff").then(({ data }) => {
      setStaff(data === true);
    });
  }, [supabase]);

  const last = messages.at(-1);
  const unread = open
    ? 0
    : messages.filter((m) => m.id > (seen ?? Infinity) && m.userId !== self).length;

  // Follow new messages, unless the reader scrolled up to read older ones.
  useEffect(() => {
    const log = logRef.current;
    if (!log || !last) return;
    const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    if (nearBottom || last.userId === self) log.scrollTop = log.scrollHeight;
  }, [last, self, open]);

  function toggle(next: boolean) {
    setOpen(next);
    if (!next) setSeen(last?.id ?? 0);
    if (drawer) {
      // Into the drawer to write; back to its button when it closes.
      requestAnimationFrame(() => {
        (next ? inputRef.current : toggleRef.current)?.focus();
      });
      return;
    }
    try {
      localStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {
      // Not remembered; it still toggles.
    }
  }

  // Escape closes the drawer.
  const escape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    toggle(false);
  });
  useEffect(() => {
    if (!drawer || !open) return;
    const onKey = (event: KeyboardEvent) => {
      escape(event);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [drawer, open]);

  async function send() {
    const body = text.trim();
    if (body === "" || sendingRef.current) return;
    sendingRef.current = true;
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("send_room_message", {
        p_room: roomId,
        p_body: body,
      });
      if (rpcError) {
        const muted = sanctionEnd(rpcError, "muted");
        setError(
          muted !== undefined
            ? sanctionNotice(muted, { until: s.mutedUntil, forever: s.muted }, locale)
            : rpcError.message === "rate_limited"
              ? s.tooFast
              : rpcError.message === "invalid_message"
                ? s.tooLong
                : s.failed,
        );
        return;
      }
      // Shown at once; Realtime's copy of it merges into the same entry.
      const sent = chatMessage(data);
      if (sent) setMessages((current) => mergeMessages(current, [sent]));
      setText("");
    } catch {
      setError(s.failed);
    } finally {
      sendingRef.current = false;
    }
  }

  async function remove(message: ChatMessage) {
    const { error: rpcError } = await supabase.rpc("delete_room_message", {
      p_message: message.id,
    });
    if (rpcError) setError(s.failed);
    else setMessages((current) => current.filter((m) => m.id !== message.id));
  }

  const unreadLabel =
    unread > 0 ? `${s.show} (${fill(s.unread, { count: unread.toLocaleString(locale) })})` : s.show;
  const badge = (className: string) =>
    unread > 0 && (
      <span
        aria-hidden="true"
        className={`flex min-w-5 items-center justify-center rounded-full bg-brand px-1 text-xs font-bold text-on-brand tabular-nums ${className}`}
      >
        {unread > 99 ? "99+" : unread.toLocaleString(locale)}
      </span>
    );

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <h2 id={`${id}-title`} className="text-base md:text-xl">
          {s.title}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label={s.hide}
          aria-expanded
          aria-controls={`${id}-panel`}
          onClick={() => {
            toggle(false);
          }}
        >
          {drawer ? (
            <X aria-hidden="true" />
          ) : (
            <>
              <ChevronDown aria-hidden="true" className="md:hidden" />
              <PanelRightClose aria-hidden="true" className="hidden md:block rtl:-scale-x-100" />
            </>
          )}
        </Button>
      </div>

      {messages.length === 0 ? (
        <p className="flex-1 text-sm text-muted">{s.empty}</p>
      ) : (
        <ol
          ref={logRef}
          role="log"
          aria-labelledby={`${id}-title`}
          className="grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto overscroll-contain pe-1"
        >
          {messages.map((m) => {
            const mine = m.userId === self;
            return (
              <li key={m.id} className="flex items-start gap-1">
                <p className="min-w-0 flex-1 break-words">
                  <span className="font-semibold">{m.nickname}</span>
                  {mine && <span className="text-sm text-muted"> ({s.you})</span>}
                  <span className="text-muted">: </span>
                  <MessageBody body={m.body} gifAlt={s.tools.gifAlt} />
                  {m.hidden && (
                    <span className="block text-xs text-muted italic">{s.report.hidden}</span>
                  )}
                </p>
                {!mine && (
                  <ChatAction
                    label={s.report.message}
                    onClick={() => {
                      setReporting({ type: "room_message", id: String(m.id), name: m.nickname });
                    }}
                  >
                    <Flag aria-hidden="true" className="size-3.5" />
                  </ChatAction>
                )}
                {staff && !mine && (
                  <ChatAction
                    label={fill(s.mute.mute, { name: m.nickname })}
                    onClick={() => {
                      setMuting({ id: m.userId, nickname: m.nickname });
                    }}
                  >
                    <VolumeX aria-hidden="true" className="size-3.5" />
                  </ChatAction>
                )}
                {(mine || staff) && (
                  <ChatAction label={s.delete} onClick={() => void remove(m)}>
                    <Trash2 aria-hidden="true" className="size-3.5" />
                  </ChatAction>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <EmojiButton
          strings={s.tools}
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
        <label htmlFor={`${id}-input`} className="sr-only">
          {s.label}
        </label>
        <Input
          ref={inputRef}
          id={`${id}-input`}
          value={text}
          maxLength={MAX_LENGTH}
          autoComplete="off"
          enterKeyHint="send"
          placeholder={s.label}
          aria-describedby={`${id}-hint`}
          onChange={(e) => {
            setText(e.target.value);
          }}
        />
        <Button type="submit" variant="outline">
          {s.send}
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <p role="status" className="text-sm font-semibold text-success empty:hidden">
        {notice ?? ""}
      </p>
      <ReportDialog
        target={reporting}
        supabase={supabase}
        strings={s.report}
        guidelinesPath={s.guidelinesPath}
        onClose={() => {
          setReporting(null);
        }}
      />
      <MuteDialog
        player={muting}
        strings={s.mute}
        onClose={() => {
          setMuting(null);
        }}
        onMute={(minutes, reason) => {
          const player = muting;
          setMuting(null);
          if (!player) return;
          void mutePlayer(supabase, player, minutes, reason, s.mute).then((done) => {
            if (done) setNotice(done);
            else setError(s.failed);
          });
        }}
      />
      {/* Shown from 768px; the phone band is too short for it (screen readers still get it). */}
      <p id={`${id}-hint`} className="hidden text-sm text-muted md:block">
        {s.hint}
      </p>
    </>
  );

  if (drawer) {
    return (
      <>
        <Button
          ref={toggleRef}
          variant="ghost"
          size="icon"
          aria-label={open ? s.hide : unreadLabel}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          className="relative"
          onClick={() => {
            toggle(!open);
          }}
        >
          <MessageSquare aria-hidden="true" />
          {!open && badge("absolute -end-1 -top-1")}
        </Button>
        {open && (
          <aside
            id={`${id}-panel`}
            aria-labelledby={`${id}-title`}
            className="fixed inset-x-0 bottom-0 z-[75] flex h-[min(60dvh,28rem)] flex-col gap-2 rounded-t-2xl border-t border-border bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-xl md:start-auto md:top-0 md:h-auto md:w-96 md:gap-3 md:rounded-none md:border-s md:border-t-0 md:pt-[max(0.75rem,env(safe-area-inset-top))]"
          >
            {body}
          </aside>
        )}
      </>
    );
  }

  if (!open) {
    return (
      <aside
        aria-label={s.title}
        className="flex shrink-0 border-t border-border bg-surface py-1 ps-[max(0.5rem,env(safe-area-inset-left))] pe-[max(0.5rem,env(safe-area-inset-right))] md:w-12 md:flex-col md:items-center md:border-s md:border-t-0 md:ps-0 md:pt-3"
      >
        <Button
          variant="ghost"
          aria-label={unreadLabel}
          aria-expanded={false}
          className="relative w-full justify-start md:size-11 md:justify-center md:px-0"
          onClick={() => {
            toggle(true);
          }}
        >
          <MessageSquare aria-hidden="true" />
          <span className="md:sr-only">{s.title}</span>
          {badge("md:absolute md:-end-1 md:-top-1")}
          <ChevronUp aria-hidden="true" className="ms-auto md:hidden" />
        </Button>
      </aside>
    );
  }

  return (
    <aside
      id={`${id}-panel`}
      aria-labelledby={`${id}-title`}
      className="flex h-64 shrink-0 flex-col gap-2 border-t border-border bg-surface py-2 ps-[max(0.75rem,env(safe-area-inset-left))] pe-[max(0.75rem,env(safe-area-inset-right))] md:h-auto md:w-80 md:gap-3 md:border-s md:border-t-0 md:py-3 md:ps-3 xl:w-96"
    >
      {body}
    </aside>
  );
}

/** A small icon button beside a message. */
function ChatAction({
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
      className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted opacity-60 hover:bg-surface-2 hover:text-text hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-focus"
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}
