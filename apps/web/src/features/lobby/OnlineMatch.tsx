// A room's match (SPEC §10.4, §10.5), full screen like the offline player: a
// short countdown, then the game with `context.online`. The room's host runs
// the match and everyone else mirrors it. The HUD shows who is away, and the
// results offer the host a rematch, which takes the room back to the lobby.
// In a rated room each player's actions also go to the server's record, and
// the results show the rating change the server works out from it.
import { LoaderCircle, LogOut, Volume2, VolumeX } from "lucide-react";
import { lazy, Suspense, useEffect, useEffectEvent, useRef, useState } from "react";

import type { GameResult, Transport } from "@kefche/game-sdk";
import {
  isMuted,
  setMuted as saveMuted,
  type GameInstance,
  type OnlineMatch as OnlineContext,
  type TurnReport,
} from "@kefche/game-sdk/browser";
import { Button } from "@kefche/ui/components/button";

import type { PlayerStrings } from "@/features/games/GamePlayer";
import { loadGame } from "@/features/games/loaders";
import { gameStorage, Overlay, useGameScreen, VOLUME } from "@/features/games/player-parts";
import { fill, resultText, type TurnStrings } from "@/features/games/turn/labels";
import { send, type Supabase } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.gen";

import { fetchRatedOutcome, recordRatedAction, type RatedOutcome } from "./rated-result";
import { roomErrorCode } from "./room-store";

import type { RoomMatch } from "./room-match";
import type { RatedRoom } from "./room-settings";
import type { RoomStrings } from "./strings";

const TurnUi = lazy(() =>
  import("@/features/games/turn/TurnUi").then((m) => ({ default: m.TurnUi })),
);

const COUNTDOWN_S = 3;

interface Props {
  supabase: Supabase;
  transport: Transport;
  roomId: string;
  self: string;
  host: string | null;
  match: RoomMatch;
  seed: string;
  /** A rated room's pool and clock, or null. */
  rated: RatedRoom | null;
  /** Seats whose person is disconnected or has left. */
  away: readonly boolean[];
  /** The match just started (not a reload mid-match): count down first. */
  countdown: boolean;
  game: { id: string; name: string; ui: Record<string, string> };
  locale: string;
  dir: "ltr" | "rtl";
  strings: RoomStrings;
  player: PlayerStrings;
  turn: TurnStrings;
  onLeave: () => void;
}

export function OnlineMatch({
  supabase,
  transport,
  roomId,
  self,
  host,
  match,
  seed,
  rated,
  away,
  countdown,
  game,
  locale,
  dir,
  strings: s,
  player,
  turn,
  onLeave,
}: Props) {
  const [count, setCount] = useState(countdown ? COUNTDOWN_S : 0);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [report, setReport] = useState<TurnReport | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [muted, setMuted] = useState(isMuted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef(host);
  const hostHandlersRef = useRef(new Set<(host: string | null) => void>());
  const isHost = host === self;
  const [rating, setRating] = useState<RatedOutcome | "checking" | null>(null);
  // Each player's actions reach the server's record in the order taken.
  const recordingRef = useRef<Promise<void>>(Promise.resolve());
  const isRated = rated !== null;
  const seat = match.setup.localSeat;
  useGameScreen(true);

  // The session reads the host through a getter and hears of changes.
  useEffect(() => {
    hostRef.current = host;
    for (const handler of hostHandlersRef.current) handler(host);
  }, [host]);

  useEffect(() => {
    if (count <= 0) return;
    const timer = setTimeout(() => {
      setCount(count - 1);
    }, 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [count]);

  const finished = useEffectEvent((over: GameResult) => {
    setResult(over);
    // The host records the end; the room then offers a rematch.
    if (hostRef.current === self) send(supabase.rpc("finish_room", { p_room: roomId }));
    // The players ask the server for the rated result (each its own rating).
    if (isRated && seat !== undefined) {
      setRating("checking");
      void fetchRatedOutcome(supabase, { roomId, seed, seat }, () => closedRef.current).then(
        (outcome) => {
          if (outcome) setRating(outcome);
        },
      );
    }
  });
  const closedRef = useRef(false);
  useEffect(
    () => () => {
      closedRef.current = true;
    },
    [],
  );

  useEffect(() => {
    if (count > 0) return;
    let instance: GameInstance | null = null;
    let cancelled = false;
    const online: OnlineContext = {
      transport,
      roomId,
      self,
      seatMembers: match.seatMembers,
      host: () => hostRef.current,
      claimHost: async (from) => {
        // No `p_from` means "nobody hosts" (the host's account was deleted).
        const { error: rpcError } = await supabase.rpc("claim_host", {
          p_room: roomId,
          ...(from === null ? {} : { p_from: from }),
        });
        return !rpcError;
      },
      onHostChange: (handler) => {
        hostHandlersRef.current.add(handler);
        return () => hostHandlersRef.current.delete(handler);
      },
      ...(isRated
        ? {
            rated: true,
            recordAction: (_seat: number, action: unknown) => {
              recordingRef.current = recordingRef.current
                .then(() => recordRatedAction(supabase, roomId, action as Json))
                .catch(() => undefined);
            },
          }
        : {}),
    };
    loadGame(game.id).then(
      (module) => {
        const stage = stageRef.current;
        if (cancelled || !stage) return;
        instance = module.mount(stage, {
          locale,
          dir,
          seed,
          t: (key, values) => fill(game.ui[key] ?? key, values),
          settings: {
            volume: VOLUME,
            haptics: true,
            reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          },
          storage: gameStorage(game.id),
          match: match.setup,
          online,
          report: (event) => {
            if (event.type === "turn") setReport(event);
            else if (event.type === "finish") finished(event.result);
          },
        });
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
      // The game has its own React root, which can't unmount while this one
      // commits (the room going back to the lobby): right after it instead.
      const closing = instance;
      queueMicrotask(() => closing?.destroy());
    };
  }, [count, attempt, transport, roomId, self, match, seed, game, locale, dir, supabase, isRated]);

  async function rematch() {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("reopen_room", { p_room: roomId });
    setBusy(false);
    if (rpcError) {
      setError(s.errors[roomErrorCode(rpcError)]);
    }
  }

  const spectating = match.setup.localSeat === undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={game.name}
      className="fixed inset-0 z-[70] flex flex-col bg-bg pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex min-h-14 items-center gap-2 border-b border-border bg-surface ps-[max(0.75rem,env(safe-area-inset-left))] pe-[max(0.75rem,env(safe-area-inset-right))]">
        <h2 className="min-w-0 flex-1 truncate text-lg">
          {game.name}
          {rated && (
            <span className="ms-2 rounded-full bg-surface-2 px-2 py-0.5 align-middle text-sm font-semibold">
              {fill(s.rated.badge, { pool: s.rated.pools[rated.pool] ?? rated.pool })}
            </span>
          )}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label={muted ? player.unmute : player.mute}
          aria-pressed={muted}
          onClick={() => {
            saveMuted(!muted);
            setMuted(!muted);
          }}
        >
          {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        </Button>
        <Button variant="ghost" size="icon" aria-label={s.leave} onClick={onLeave}>
          <LogOut aria-hidden="true" className="rtl:-scale-x-100" />
        </Button>
      </div>

      {count === 0 && (
        <Suspense fallback={null}>
          <TurnUi
            part="hud"
            seats={match.setup.seats}
            timer={match.setup.timer}
            report={report}
            strings={turn}
            away={{ seats: away, label: s.away }}
          />
        </Suspense>
      )}
      {spectating && <p className="bg-surface-2 px-3 py-1 text-center text-sm">{s.spectating}</p>}

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-3">
        <div ref={stageRef} className="flex h-full w-full items-center justify-center" />

        {count > 0 && (
          <Overlay>
            <p role="status" className="text-3xl font-semibold tabular-nums">
              {fill(s.countdown, { seconds: count.toLocaleString(locale) })}
            </p>
          </Overlay>
        )}
        {count === 0 && !report && !failed && (
          <p
            role="status"
            className="absolute inset-0 flex items-center justify-center gap-3 text-lg"
          >
            <LoaderCircle
              aria-hidden="true"
              className="size-6 animate-spin motion-reduce:animate-none"
            />
            {player.loading}
          </p>
        )}
        {failed && (
          <Overlay>
            <p role="alert" className="text-lg">
              {player.loadFailed}
            </p>
            <Button
              onClick={() => {
                setFailed(false);
                setAttempt(attempt + 1);
              }}
            >
              {player.retry}
            </Button>
          </Overlay>
        )}
        {result && (
          <Overlay placement="bottom">
            <p role="status" className="text-3xl font-semibold">
              {resultText(result, match.setup, turn, locale)}
            </p>
            {rating && <RatingLine rating={rating} strings={s.rated} locale={locale} />}
            {isHost ? (
              <Button disabled={busy} onClick={() => void rematch()}>
                {s.rematch}
              </Button>
            ) : (
              <p className="text-muted">{s.waitingHost}</p>
            )}
            <Button variant="ghost" onClick={onLeave}>
              {s.leave}
            </Button>
            {error && (
              <p role="alert" className="font-semibold text-danger">
                {error}
              </p>
            )}
          </Overlay>
        )}
      </div>
    </div>
  );
}

function RatingLine({
  rating,
  strings: r,
  locale,
}: {
  rating: RatedOutcome | "checking";
  strings: RoomStrings["rated"];
  locale: string;
}) {
  if (rating === "checking") return <p className="text-muted">{r.checking}</p>;
  if (rating.kind === "review") return <p className="text-muted">{r.review}</p>;
  if (rating.kind === "failed") return <p className="text-muted">{r.failed}</p>;
  const whole = (n: number) => Math.round(n).toLocaleString(locale);
  const change = new Intl.NumberFormat(locale, { signDisplay: "exceptZero" }).format(
    Math.round(rating.after) - Math.round(rating.before),
  );
  return (
    <p role="status" className="text-lg font-semibold tabular-nums">
      {fill(r.change, { before: whole(rating.before), after: whole(rating.after), change })}
    </p>
  );
}
