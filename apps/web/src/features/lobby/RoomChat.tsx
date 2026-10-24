// The lobby's chat (SPEC §6.4, §8.2): the room's latest messages, live, and
// a line to write one, for everyone in the room. The database masks blocked
// words and limits how fast anyone can send.
//
// It is a fixed pane of the room page, and the room scrolls beside it: a
// column on the right from 768px, a band along the bottom on phones. It
// folds into a strip (a bar on phones) that counts new messages. It starts
// open; the choice is remembered in this browser.
import { ChevronDown, ChevronUp, MessageSquare, PanelRightClose } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@kefche/ui/components/button";
import { Input } from "@kefche/ui/components/input";

import { fill } from "@/features/games/turn/labels";
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
}

export function RoomChat({ supabase, roomId, self, locale, strings: s }: Props) {
  const id = useId();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(initiallyOpen);
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
        () => {
          setError(s.failed);
        },
      ),
    [supabase, roomId, s],
  );

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
    try {
      localStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {
      // Not remembered; it still toggles.
    }
  }

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
        setError(
          rpcError.message === "rate_limited"
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

  if (!open) {
    return (
      <aside
        aria-label={s.title}
        className="flex shrink-0 border-t border-border bg-surface py-1 ps-[max(0.5rem,env(safe-area-inset-left))] pe-[max(0.5rem,env(safe-area-inset-right))] md:w-12 md:flex-col md:items-center md:border-s md:border-t-0 md:ps-0 md:pt-3"
      >
        <Button
          variant="ghost"
          aria-label={
            unread > 0
              ? `${s.show} (${fill(s.unread, { count: unread.toLocaleString(locale) })})`
              : s.show
          }
          aria-expanded={false}
          className="relative w-full justify-start md:size-11 md:justify-center md:px-0"
          onClick={() => {
            toggle(true);
          }}
        >
          <MessageSquare aria-hidden="true" />
          <span className="md:sr-only">{s.title}</span>
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="flex min-w-5 items-center justify-center rounded-full bg-brand px-1 text-xs font-bold text-on-brand tabular-nums md:absolute md:-end-1 md:-top-1"
            >
              {unread > 99 ? "99+" : unread.toLocaleString(locale)}
            </span>
          )}
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
          <ChevronDown aria-hidden="true" className="md:hidden" />
          <PanelRightClose aria-hidden="true" className="hidden md:block rtl:-scale-x-100" />
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
          {messages.map((m) => (
            <li key={m.id} className="break-words">
              <span className="font-semibold">{m.nickname}</span>
              {m.userId === self && <span className="text-sm text-muted"> ({s.you})</span>}
              <span className="text-muted">: </span>
              <span dir="auto">{m.body}</span>
            </li>
          ))}
        </ol>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor={`${id}-input`} className="sr-only">
          {s.label}
        </label>
        <Input
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
      {/* Shown from 768px; the phone band is too short for it (screen readers still get it). */}
      <p id={`${id}-hint`} className="hidden text-sm text-muted md:block">
        {s.hint}
      </p>
    </aside>
  );
}
