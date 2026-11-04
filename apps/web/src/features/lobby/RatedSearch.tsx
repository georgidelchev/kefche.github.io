// Rated matchmaking (SPEC §10.7). While this screen is open it asks
// rated_search every 2 s, which keeps the player in the queue and pairs them
// as soon as someone within the rating window searches the same clock. It
// shows how many are searching, the estimated wait and the ratings it looks
// for (the window widens from ±100 to ±400 over 30 s). Cancel, or leaving
// the screen, takes the player out of the queue.
import { LoaderCircle } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import * as z from "zod/mini";

import { Button } from "@kefche/ui/components/button";

import { fill } from "@/features/games/turn/labels";
import { send, type Supabase } from "@/lib/supabase/client";

import type { RatedStrings } from "./strings";

const POLL_MS = 2000;

const roomSchema = z.object({ id: z.string(), code: z.string() });
const answerSchema = z.object({
  room: z.nullable(roomSchema),
  searching: z.number(),
  waitSeconds: z.nullable(z.number()),
  rating: z.number(),
  window: z.number(),
});
type Answer = z.infer<typeof answerSchema>;
type PairedRoom = z.infer<typeof roomSchema>;

interface Props {
  supabase: Supabase;
  game: { id: string; version: number };
  /** The clock: an index into the manifest's timers. */
  timer: number;
  /** "5 + 3 · Blitz" */
  label: string;
  strings: RatedStrings;
  locale: string;
  onPaired: (room: PairedRoom) => void;
  onCancel: () => void;
  /** The database's refusal, for roomErrorText. */
  onError: (error: unknown) => void;
}

/** "about 15 s", "about 2 min". */
function waitTime(seconds: number, locale: string): string {
  const minutes = seconds >= 90;
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: minutes ? "minute" : "second",
    unitDisplay: "short",
    maximumFractionDigits: 0,
  }).format(minutes ? seconds / 60 : Math.max(1, seconds));
}

export function RatedSearch({
  supabase,
  game,
  timer,
  label,
  strings: s,
  locale,
  onPaired,
  onCancel,
  onError,
}: Props) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // Stops asking and settles the request in flight: its room, if it paired.
  const stopRef = useRef<(() => Promise<PairedRoom | null>) | null>(null);
  const paired = useEffectEvent(onPaired);
  const failed = useEffectEvent(onError);

  useEffect(() => {
    let stopped = false;
    let room: PairedRoom | null = null;
    let next: ReturnType<typeof setTimeout> | undefined;
    let current: Promise<void> = Promise.resolve();
    const ask = async () => {
      const { data, error } = await supabase.rpc("rated_search", {
        p_game_id: game.id,
        p_game_version: game.version,
        p_timer: timer,
      });
      if (error?.code) {
        // The database said no (a guest, a suspension, too many tries): final.
        if (!stopped) failed(error);
        return;
      }
      const parsed = error ? null : answerSchema.safeParse(data);
      if (parsed?.success) {
        if (parsed.data.room) {
          room = parsed.data.room;
          if (!stopped) paired(room);
          return;
        }
        if (!stopped) setAnswer(parsed.data);
      }
      // A lost request is simply asked again.
      if (!stopped) {
        next = setTimeout(() => {
          current = ask();
        }, POLL_MS);
      }
    };
    current = ask();
    const stop = async () => {
      stopped = true;
      clearTimeout(next);
      await current;
      return room;
    };
    stopRef.current = stop;
    return () => {
      // Out of the queue, unless the last request paired the player after all.
      void stop().then((found) => {
        if (!found) send(supabase.rpc("cancel_rated_search"));
      });
    };
  }, [supabase, game.id, game.version, timer]);

  async function cancel() {
    setCancelling(true);
    const room = await stopRef.current?.();
    // Paired at the last moment: the opponent is waiting, so play.
    if (room) {
      onPaired(room);
      return;
    }
    await supabase.rpc("cancel_rated_search");
    onCancel();
  }

  const number = (n: number) => Math.round(n).toLocaleString(locale);
  return (
    <div className="grid max-w-md justify-items-start gap-4 rounded-2xl border border-border bg-surface p-5">
      <p role="status" className="flex items-center gap-3 text-lg font-semibold">
        <LoaderCircle
          aria-hidden="true"
          className="size-6 animate-spin motion-reduce:animate-none"
        />
        {s.searching}
      </p>
      <p className="text-xl">{label}</p>
      {answer && (
        <ul className="grid gap-1 text-sm text-muted">
          <li>{fill(s.searchingNow, { count: number(answer.searching) })}</li>
          <li>
            {answer.waitSeconds === null
              ? s.waitUnknown
              : fill(s.wait, { time: waitTime(answer.waitSeconds, locale) })}
          </li>
          <li>
            {fill(s.range, {
              low: number(answer.rating - answer.window),
              high: number(answer.rating + answer.window),
            })}
          </li>
        </ul>
      )}
      <Button variant="outline" disabled={cancelling} onClick={() => void cancel()}>
        {s.cancel}
      </Button>
    </div>
  );
}
