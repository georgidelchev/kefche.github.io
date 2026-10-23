// The lobby's chat (SPEC §6.4, §8.2): the room's latest messages, live, and
// a line to write one. Everyone in the room can chat once past the age gate;
// a guest confirms "13 or older" here first. The database masks blocked
// words and limits how fast anyone can send.
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@kefche/ui/components/button";
import { Input } from "@kefche/ui/components/input";

import type { Supabase } from "@/lib/supabase/client";
import { nullable } from "@/lib/supabase/client";

import { chatMessage, mergeMessages, watchChat, type ChatMessage } from "./room-chat";

import type { ChatStrings } from "./strings";

const MAX_LENGTH = 300;

interface Props {
  supabase: Supabase;
  roomId: string;
  self: string;
  guest: boolean;
  /** Passed the age gate already (identity.canChat). */
  canChat: boolean;
  strings: ChatStrings;
}

export function RoomChat({ supabase, roomId, self, guest, canChat, strings: s }: Props) {
  const id = useId();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(canChat);
  const logRef = useRef<HTMLOListElement>(null);
  const sendingRef = useRef(false);

  useEffect(
    () =>
      watchChat(
        supabase,
        roomId,
        (added) => {
          setMessages((current) => mergeMessages(current, added));
        },
        () => {
          setError(s.failed);
        },
      ),
    [supabase, roomId, s],
  );

  // Follow new messages, unless the reader scrolled up to read older ones.
  const last = messages.at(-1);
  useEffect(() => {
    const log = logRef.current;
    if (!log || !last) return;
    const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    if (nearBottom || last.userId === self) log.scrollTop = log.scrollHeight;
  }, [last, self]);

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
        if (rpcError.message === "age_unconfirmed") setAllowed(false);
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

  return (
    <section
      className="grid gap-3 rounded-2xl border border-border bg-surface p-4"
      aria-labelledby={`${id}-title`}
    >
      <h2 id={`${id}-title`} className="text-xl">
        {s.title}
      </h2>
      {messages.length === 0 ? (
        <p className="text-sm text-muted">{s.empty}</p>
      ) : (
        <ol
          ref={logRef}
          role="log"
          aria-labelledby={`${id}-title`}
          className="grid max-h-72 gap-1.5 overflow-y-auto overscroll-contain pe-1"
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

      {allowed ? (
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
      ) : (
        <AgeGate
          supabase={supabase}
          guest={guest}
          strings={s}
          onDone={() => {
            setAllowed(true);
          }}
        />
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <p id={`${id}-hint`} className="text-sm text-muted">
        {s.hint}
      </p>
    </section>
  );
}

// A guest confirms being 13 or older once (SPEC §7.1); accounts gave a birth
// date when they signed up, so they never see this.
function AgeGate({
  supabase,
  guest,
  strings: s,
  onDone,
}: {
  supabase: Supabase;
  guest: boolean;
  strings: ChatStrings;
  onDone: () => void;
}) {
  const id = useId();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!guest) return <p className="text-sm">{s.ageNeeded}</p>;

  async function confirm() {
    if (!confirmed) {
      setError(s.ageNeeded);
      return;
    }
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("set_guest_profile", {
      p_age_confirmed: true,
    });
    if (rpcError || nullable(data) !== null) setError(s.failed);
    else onDone();
  }

  return (
    <form
      className="grid justify-items-start gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void confirm();
      }}
    >
      <p className="text-sm">{s.ageNeeded}</p>
      <label htmlFor={`${id}-age`} className="flex min-h-11 items-center gap-3 font-semibold">
        <input
          id={`${id}-age`}
          type="checkbox"
          className="size-5 accent-brand"
          checked={confirmed}
          onChange={(e) => {
            setConfirmed(e.target.checked);
          }}
        />
        {s.ageConfirm}
      </label>
      <Button type="submit" variant="outline">
        {s.ageSubmit}
      </Button>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
