// A room's race (Phase 5 step 10): everyone plays the same game from the
// same seed with the room's options, full screen, next to live standings.
//
// - Every browser mirrors its own player's game with the engine (from the
//   actions the game records) and relays its progress, which all members
//   hear, so the standings move as people play.
// - When a player's game ends, or the time limit runs out, their browser
//   sends the host the packed moves. The host replays them on the seed
//   (`checkRace`), and only that result counts. The host relays the checked
//   results (`standings`) and ends the race once everyone has finished or
//   the time is up, then offers a rematch.
// - If the host goes away, the first seated member here takes over, and
//   everyone who finished sends their moves again.
// - Progress carries each player's moves so far, so every browser replays
//   them and draws the other players' boards live (the game's MiniView).
// - Everyone counts down on the database's clock (`server_time`), and the
//   game is loaded during the countdown, so all start at the same moment.
import { LoaderCircle, LogOut, Trophy, Volume2, VolumeX } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import {
  createMessenger,
  packActions,
  unpackActions,
  type Message,
  type Payload,
  type RaceEngine,
  type Transport,
} from "@kefche/game-sdk";
import {
  formatDuration,
  isMuted,
  setMuted as saveMuted,
  type GameInstance,
  type GameModule,
  type MiniView,
} from "@kefche/game-sdk/browser";
import { Button } from "@kefche/ui/components/button";

import type { PlayerStrings } from "@/features/games/GamePlayer";
import { loadGame, loadRaceEngine } from "@/features/games/loaders";
import type { RaceSetup } from "@/features/games/page-props";
import { gameStorage, Overlay, useGameScreen, VOLUME } from "@/features/games/player-parts";
import { fill } from "@/features/games/turn/labels";
import { send, type Supabase } from "@/lib/supabase/client";

import { checkRace, raceConfig, rank, type Standing } from "./race-standings";
import { roomErrorCode } from "./room-store";

import type { RoomMatch } from "./room-match";
import type { RaceOptionValues } from "./room-settings";
import type { RaceStrings, RoomStrings } from "./strings";

const COUNTDOWN_MS = 3000;
/** Progress (with the moves, for the live mini boards) goes out at most this often. */
const PROGRESS_MS = 500;
/** After the time limit, how long the host waits for the last moves to arrive. */
const GRACE_MS = 5000;
/** How long the host may be gone before someone takes over. */
const HOST_TIMEOUT_MS = 5000;

type Progress = Payload<"progress">;
type Result = Payload<"standings">["results"][number];

interface Props {
  supabase: Supabase;
  transport: Transport;
  roomId: string;
  self: string;
  host: string | null;
  match: RoomMatch;
  seed: string;
  /** start_room's clock; the race itself starts after the countdown. */
  startedAt: number | null;
  limitMs: number;
  /** The match just started (not a reload): show the countdown. */
  countdown: boolean;
  present: ReadonlySet<string>;
  game: { id: string; name: string; ui: Record<string, string>; race: RaceSetup };
  options: RaceOptionValues;
  locale: string;
  dir: "ltr" | "rtl";
  strings: RoomStrings;
  race: RaceStrings;
  player: PlayerStrings;
  onLeave: () => void;
}

interface Local {
  engine: RaceEngine<unknown, unknown, unknown>;
  /** Where everyone starts. */
  initial: unknown;
  state: unknown;
  actions: unknown[];
}

type AttachView = (member: string, view: MiniView | null) => void;

/** Another player's board, drawn by the game's MiniView (fed by the race, not by React). */
function MiniBoard({
  module,
  member,
  attach,
}: {
  module: GameModule;
  member: string;
  attach: AttachView;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !module.mini) return;
    const view = module.mini(container);
    attach(member, view);
    return () => {
      attach(member, null);
      view.destroy();
    };
  }, [module, member, attach]);
  return <div ref={containerRef} className="mx-auto w-20 md:w-full md:max-w-44" />;
}

export function RaceMatch({
  supabase,
  transport,
  roomId,
  self,
  host,
  match,
  seed,
  startedAt,
  limitMs,
  countdown,
  present,
  game,
  options,
  locale,
  dir,
  strings: s,
  race: rs,
  player,
  onLeave,
}: Props) {
  // Fixed for the whole race, also after a reload: the database's start time.
  const [raceStart] = useState(() => (startedAt ?? Date.now()) + COUNTDOWN_MS);
  const end = raceStart + limitMs;
  const [now, setNow] = useState(() => Date.now());
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [mine, setMine] = useState<Progress>({ score: 0, progress: 0, finished: false });
  const [others, setOthers] = useState<ReadonlyMap<string, Progress>>(() => new Map());
  const [checked, setChecked] = useState<ReadonlyMap<string, Result>>(() => new Map());
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(isMuted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const localRef = useRef<Local | null>(null);
  const sentToRef = useRef<string | null>(null);
  const [message] = useState(() => createMessenger(roomId, self));
  const [config] = useState(() => raceConfig(game.race.options, options));
  // Other players' boards: the game's MiniView for each, and each player's
  // state replayed from the moves they relay, which goes straight to it.
  const [module, setModule] = useState<GameModule | null>(null);
  const replicasRef = useRef(new Map<string, { applied: number; state: unknown }>());
  const viewsRef = useRef(new Map<string, MiniView>());
  const [attachView] = useState((): AttachView => (member, view) => {
    if (!view) {
      viewsRef.current.delete(member);
      return;
    }
    viewsRef.current.set(member, view);
    const state = replicasRef.current.get(member)?.state ?? localRef.current?.initial;
    if (state !== undefined) view.update(state);
  });
  // The database's clock minus this device's (ms): every browser counts down
  // to the same moment, whatever its own clock says.
  const offsetRef = useRef(0);
  // Nothing starts before the clocks agree (or the measurement gave up).
  const [synced, setSynced] = useState(false);
  const isHost = host === self;
  const seated = match.setup.localSeat !== undefined;
  const timeUp = now >= end;
  useGameScreen(true);

  useEffect(() => {
    const closed = new AbortController();
    void (async () => {
      // The quickest of three round trips is the most accurate.
      let best: { offset: number; rtt: number } | null = null;
      for (let i = 0; i < 3; i++) {
        const t0 = Date.now();
        const { data, error: rpcError } = await supabase.rpc("server_time");
        const t1 = Date.now();
        if (rpcError) continue;
        const sample = { offset: data - (t0 + t1) / 2, rtt: t1 - t0 };
        if (!best || sample.rtt < best.rtt) best = sample;
      }
      if (closed.signal.aborted) return;
      if (best) offsetRef.current = best.offset;
      setNow(Date.now() + offsetRef.current);
      setSynced(true);
    })();
    return () => {
      closed.abort();
    };
  }, [supabase]);

  // Loaded during the countdown, so the game starts the moment it ends.
  useEffect(() => {
    loadRaceEngine(game.id).catch(() => undefined);
    loadGame(game.id).catch(() => undefined);
  }, [game.id]);

  const counting = now < raceStart;
  // A reload mid-race skips the countdown it already saw.
  const showCount = (counting || !synced) && countdown;
  const started = synced && !showCount;

  // ---------------------------------------------------------- the host side
  const resultsRef = useRef(new Map<string, Result>());
  const broadcastStandings = useEffectEvent(
    ({ to, over = ended }: { to?: string; over?: boolean } = {}) => {
      const payload = { results: [...resultsRef.current.values()], ended: over };
      if (to) transport.send(to, message("standings", payload));
      else transport.broadcast(message("standings", payload));
    },
  );
  const hostCheck = useEffectEvent((member: string, log: Payload<"finish">["log"]) => {
    const local = localRef.current;
    if (!local || !match.seatMembers.includes(member) || resultsRef.current.has(member)) return;
    const result = checkRace(local.engine, config, seed, log);
    const entry: Result = {
      member,
      score: result.score,
      // As the host saw it, and never past the time limit.
      timeMs: Math.max(0, Math.min(Date.now() + offsetRef.current, end) - raceStart),
      completed: result.completed,
      valid: result.valid,
    };
    resultsRef.current.set(member, entry);
    setChecked(new Map(resultsRef.current));
    broadcastStandings();
  });

  // Over when every seated player still here has a checked result, or the
  // time limit (plus the grace for the last moves) has passed.
  const checkEnd = useEffectEvent(() => {
    if (!isHost || ended) return;
    const players = match.seatMembers.filter((m): m is string => m !== null && present.has(m));
    const allIn = players.length > 0 && players.every((m) => resultsRef.current.has(m));
    if (allIn || Date.now() + offsetRef.current >= end + GRACE_MS) {
      setEnded(true);
      broadcastStandings({ over: true });
      send(supabase.rpc("finish_room", { p_room: roomId }));
    }
  });

  // ---------------------------------------------------------------- sending
  const lastSentRef = useRef(0);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** The moves so far, to the host now (once per host). */
  const sendFinish = useEffectEvent(() => {
    const local = localRef.current;
    if (!local || !seated || host === null || sentToRef.current === host) return;
    sentToRef.current = host;
    const log = packActions(local.actions);
    if (host === self) hostCheck(self, log);
    else transport.send(host, message("finish", { log }));
  });

  const sendProgress = useEffectEvent(() => {
    const local = localRef.current;
    if (!local || !seated) return;
    const result = local.engine.result(local.state);
    const progress: Progress = {
      score: local.engine.score?.(local.state) ?? result?.score ?? 0,
      progress: local.engine.progress(local.state),
      finished: result !== null,
    };
    setMine(progress);
    lastSentRef.current = Date.now();
    // With the moves so far, so the others can draw this board live.
    transport.broadcast(message("progress", { ...progress, log: packActions(local.actions) }));
    if (progress.finished) sendFinish();
  });

  // A new host needs to hear from everyone again, and a newcomer asks what
  // the host has checked so far.
  const onHost = useEffectEvent(() => {
    sentToRef.current = null;
    const local = localRef.current;
    if (local && (timeUp || local.engine.result(local.state) !== null)) sendFinish();
    if (host !== null && host !== self) transport.send(host, message("sync", {}));
  });
  // Newcomers hear where everyone is.
  const onPresence = useEffectEvent(() => {
    if (localRef.current) sendProgress();
  });

  // The clock: the countdown, the time left, and the host's end check.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now() + offsetRef.current);
      checkEnd();
    }, 250);
    return () => {
      clearInterval(timer);
    };
  }, []);
  // Time's up: everyone still playing hands in what they have.
  useEffect(() => {
    if (timeUp) sendFinish();
  }, [timeUp]);
  useEffect(() => {
    onHost();
  }, [host]);
  useEffect(() => {
    onPresence();
  }, [present]);

  // If the host is gone for a while, the first seated member here takes over.
  useEffect(() => {
    if (host !== null && present.has(host)) return;
    const next = match.seatMembers.find((m) => m !== null && present.has(m));
    if (next !== self) return;
    const timer = setTimeout(() => {
      send(
        supabase.rpc("claim_host", {
          p_room: roomId,
          ...(host === null ? {} : { p_from: host }),
        }),
      );
    }, HOST_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [host, present, match, self, supabase, roomId]);

  // ---------------------------------------------------------------- receiving
  /** Replays a player's relayed moves onto their mirrored board (only the new ones). */
  const followBoard = useEffectEvent((member: string, log: Payload<"finish">["log"]) => {
    const local = localRef.current;
    const actions = unpackActions(log);
    if (!local || !actions) return;
    let replica = replicasRef.current.get(member);
    // A shorter log: that player started again (a reload).
    if (!replica || actions.length < replica.applied) {
      replica = { applied: 0, state: local.initial };
    }
    // Every state on the way, so their board can play the moves back.
    const steps: unknown[] = [];
    try {
      let state = replica.state;
      for (let i = replica.applied; i < actions.length; i++) {
        state = local.engine.apply(state, actions[i]);
        steps.push(state);
      }
      replica = { applied: actions.length, state };
    } catch {
      return;
    }
    replicasRef.current.set(member, replica);
    if (steps.length > 0) viewsRef.current.get(member)?.update(replica.state, steps);
  });

  const onMessage = useEffectEvent((m: Message) => {
    if (m.type === "progress") {
      if (!match.seatMembers.includes(m.from)) return;
      setOthers((map) => new Map(map).set(m.from, m.payload));
      if (m.payload.log) followBoard(m.from, m.payload.log);
    } else if (m.type === "finish") {
      if (isHost) hostCheck(m.from, m.payload.log);
    } else if (m.type === "standings") {
      // The host keeps its own; everyone else follows the host's.
      if (isHost || m.from !== host) return;
      setChecked(new Map(m.payload.results.map((r) => [r.member, r])));
      if (m.payload.ended) setEnded(true);
    } else if (m.type === "sync") {
      if (isHost) broadcastStandings({ to: m.from });
    }
  });
  useEffect(
    () =>
      transport.onMessage((m) => {
        onMessage(m);
      }),
    [transport],
  );

  // ------------------------------------------------------------- the game
  // Mounted once the countdown is over (at once after a reload), and again
  // after a failed load's retry.
  const mountGame = useEffectEvent(() => {
    let instance: GameInstance | null = null;
    let cancelled = false;
    // Progress goes out at most every PROGRESS_MS while the player plays.
    const queueProgress = () => {
      if (pendingRef.current !== null) return;
      const wait = Math.max(0, lastSentRef.current + PROGRESS_MS - Date.now());
      pendingRef.current = setTimeout(() => {
        pendingRef.current = null;
        sendProgress();
      }, wait);
    };
    // Spectators load the game too: it draws everyone's mini board.
    Promise.all([loadRaceEngine(game.id), loadGame(game.id)]).then(
      ([engine, loaded]) => {
        if (cancelled) return;
        const start = engine.initialState(config, seed);
        localRef.current = { engine, initial: start, state: start, actions: [] };
        setModule(loaded);
        sendProgress();
        const stage = stageRef.current;
        if (!seated || !stage) return;
        instance = loaded.mount(stage, {
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
          race: {
            config,
            record: (action) => {
              const local = localRef.current;
              // After the time limit the moves no longer count.
              if (!local || Date.now() + offsetRef.current >= end) return;
              local.actions.push(action);
              local.state = local.engine.apply(local.state, action);
              queueProgress();
            },
          },
          report: () => undefined,
        });
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
      if (pendingRef.current !== null) clearTimeout(pendingRef.current);
      // Or the next mount's progress would wait on a timer that never fires.
      pendingRef.current = null;
      const closing = instance;
      queueMicrotask(() => closing?.destroy());
    };
  });
  useEffect(() => {
    if (!started) return;
    return mountGame();
  }, [started, attempt]);

  async function rematch() {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("reopen_room", { p_room: roomId });
    setBusy(false);
    if (rpcError) setError(s.errors[roomErrorCode(rpcError)]);
  }

  // ---------------------------------------------------------- the standings
  const rows = rank(
    match.seatMembers.flatMap((member, seat): Standing[] => {
      if (member === null) return [];
      const live = member === self ? mine : others.get(member);
      const result = checked.get(member);
      return [
        {
          member,
          name: match.setup.names[seat] ?? "?",
          score: result?.score ?? live?.score ?? 0,
          progress: live?.progress ?? 0,
          finished: live?.finished ?? false,
          completed: result?.completed ?? false,
          timeMs: result?.timeMs ?? null,
          valid: result?.valid ?? null,
        },
      ];
    }),
    game.race.ranking,
  );
  const place = rows.findIndex((r) => r.member === self) + 1;
  const left = Math.max(0, (counting ? raceStart : end) - now);
  const detail = (row: Standing) => {
    if (row.valid === false) return rs.notChecked;
    if (game.race.ranking === "time") {
      return row.completed && row.timeMs !== null
        ? formatDuration(row.timeMs)
        : fill(rs.progress, { percent: Math.round(row.progress * 100).toLocaleString(locale) });
    }
    return fill(rs.points, { score: row.score.toLocaleString(locale) });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={game.name}
      className="fixed inset-0 z-[70] flex flex-col bg-bg pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex min-h-14 items-center gap-2 border-b border-border bg-surface ps-[max(0.75rem,env(safe-area-inset-left))] pe-[max(0.75rem,env(safe-area-inset-right))]">
        <h2 className="min-w-0 flex-1 truncate text-lg">{game.name}</h2>
        {!counting && (
          <p className="text-sm font-semibold tabular-nums">
            <span className="sr-only">{rs.timeLeft}: </span>
            <span aria-hidden="true" className="text-muted">
              {rs.timeLeft}{" "}
            </span>
            {formatDuration(left)}
          </p>
        )}
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
      {!seated && <p className="bg-surface-2 px-3 py-1 text-center text-sm">{s.spectating}</p>}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section
          aria-label={rs.standings}
          className="shrink-0 border-b border-border bg-surface md:order-last md:w-72 md:overflow-y-auto md:border-s md:border-b-0"
        >
          <h3 className="sr-only">{rs.standings}</h3>
          <ol className="flex gap-2 overflow-x-auto p-2 md:grid md:gap-2 md:overflow-visible md:p-3">
            {rows.map((row, i) => {
              // Everyone else's board, live (yours is the big one).
              const board = row.member !== self && module?.mini ? module : null;
              return (
                <li
                  key={row.member}
                  className="grid min-w-36 content-start gap-1.5 rounded-lg bg-surface-2 p-2 text-sm md:min-w-0"
                  data-self={row.member === self ? "" : undefined}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 font-semibold tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {row.name}
                      {row.member === self && (
                        <span className="font-normal text-muted"> ({s.you})</span>
                      )}
                    </span>
                    <span className="text-muted tabular-nums">{detail(row)}</span>
                  </div>
                  {row.finished && row.valid !== false && (
                    <span className="text-xs font-semibold text-muted">
                      {row.completed ? rs.solved : rs.gameOver}
                    </span>
                  )}
                  {board && <MiniBoard module={board} member={row.member} attach={attachView} />}
                </li>
              );
            })}
          </ol>
        </section>

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-3">
          <div ref={stageRef} className="flex h-full w-full items-center justify-center" />

          {showCount && (
            <Overlay>
              <p role="status" className="text-3xl font-semibold tabular-nums">
                {fill(s.countdown, {
                  // Within 3…1 while the clocks are still being lined up.
                  seconds: Math.min(
                    COUNTDOWN_MS / 1000,
                    Math.max(1, Math.ceil((raceStart - now) / 1000)),
                  ).toLocaleString(locale),
                })}
              </p>
            </Overlay>
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
          {!ended && seated && mine.finished && !timeUp && (
            <p
              role="status"
              className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-surface-2 px-4 py-2 text-sm font-semibold"
            >
              {rs.waitingOthers}
            </p>
          )}
          {!ended && timeUp && (
            <Overlay>
              <p role="status" className="flex items-center gap-3 text-lg">
                <LoaderCircle
                  aria-hidden="true"
                  className="size-6 animate-spin motion-reduce:animate-none"
                />
                {rs.timeUp} {rs.checking}
              </p>
            </Overlay>
          )}
          {ended && (
            <Overlay placement="bottom">
              <p role="status" className="flex items-center gap-2 text-3xl font-semibold">
                {place === 1 && rows[0]?.valid !== false && (
                  <Trophy aria-hidden="true" className="size-8 text-brand-strong" />
                )}
                {!seated
                  ? timeUp
                    ? rs.timeUp
                    : rs.allFinished
                  : place === 1
                    ? rs.youWon
                    : fill(rs.yourPlace, {
                        place: place.toLocaleString(locale),
                        count: rows.length.toLocaleString(locale),
                      })}
              </p>
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
    </div>
  );
}
