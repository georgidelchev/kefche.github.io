// Full-screen game player (SPEC §9.1): loads the game's code when Play is
// pressed, mounts it, and owns the chrome around it: pause menu, mute, exit,
// results, screen wake lock. The game draws everything inside the stage.
// Turn-based games (Phase 4) first get a setup screen (seats, bots, timer)
// and a HUD with every seat, whose turn it is and the clocks.
import { LoaderCircle, Pause, Play, Users, Bot, Volume2, VolumeX, X } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";

import { randomSeed, type GameResult } from "@kefche/game-sdk";
import {
  HAPTICS,
  createSoundService,
  formatDuration,
  isMuted,
  setMuted as saveMuted,
  vibrate,
  type GameInstance,
  type GameStorage,
  type MatchSetup,
  type TurnReport,
} from "@kefche/game-sdk/browser";
import { Button } from "@kefche/ui/components/button";

import { loadGame } from "./loaders";
import { fill, resultText, seatName, type TurnStrings } from "./turn/labels";
import {
  loadChoice,
  saveChoice,
  toMatch,
  type SetupChoice,
  type TurnConfig,
  type TurnMode,
} from "./turn/match-setup";

const TurnSetup = lazy(() => import("./turn/TurnUi").then((m) => ({ default: m.TurnSetup })));
const TurnHud = lazy(() => import("./turn/TurnUi").then((m) => ({ default: m.TurnHud })));

export interface PlayerStrings {
  play: string;
  loading: string;
  loadFailed: string;
  retry: string;
  pause: string;
  paused: string;
  resume: string;
  restart: string;
  exit: string;
  mute: string;
  unmute: string;
  won: string;
  gameOver: string;
  /** With a {score} placeholder already formatted for the locale. */
  score: string;
  time: string;
  playAgain: string;
}

interface Props {
  id: string;
  name: string;
  locale: string;
  dir: "ltr" | "rtl";
  strings: PlayerStrings;
  /** The game's own UI strings (i18n/<locale>.json "ui"). */
  ui: Record<string, string>;
  /** Turn-based games: what the setup screen offers, and its text. */
  turn?: { config: TurnConfig; strings: TurnStrings };
}

type Phase = "idle" | "setup" | "loading" | "playing" | "paused" | "finished" | "error";

// "Quiet", the owner's pick in the Phase 3 sound picker. A volume slider
// arrives with the settings in Phase 16.
const VOLUME = 0.22;

function gameStorage(id: string): GameStorage {
  return {
    get: (key) => {
      try {
        return localStorage.getItem(`kefche:game:${id}:${key}`);
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        if (value === null) localStorage.removeItem(`kefche:game:${id}:${key}`);
        else localStorage.setItem(`kefche:game:${id}:${key}`, value);
      } catch {
        // Not saved; the game goes on.
      }
    },
  };
}

const MODE_ICONS = { "solo-bots": Bot, hotseat: Users } as const;

export function GamePlayer({ id, name, locale, dir, strings, ui, turn }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<GameResult | null>(null);
  const [muted, setMuted] = useState(false);
  const [mode, setMode] = useState<TurnMode>("solo-bots");
  const [choice, setChoice] = useState<SetupChoice | null>(null);
  const [match, setMatch] = useState<MatchSetup | null>(null);
  const [report, setReport] = useState<TurnReport | null>(null);
  const [codeReady, setCodeReady] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<GameInstance | null>(null);
  const pauseRef = useRef<HTMLButtonElement>(null);
  // The main button of the pause, results or setup screen, focused when it opens.
  const overlayActionRef = useRef<HTMLButtonElement>(null);
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  const storage = useRef(gameStorage(id)).current;
  const lowTimeSoundRef = useRef<ReturnType<typeof createLowTimeSound> | null>(null);

  const open = phase !== "idle";

  async function mount(seed: string, setup: MatchSetup | null) {
    instanceRef.current?.destroy();
    instanceRef.current = null;
    setPhase("loading");
    setResult(null);
    setReport(null);
    setMuted(isMuted());
    try {
      const game = await loadGame(id);
      const stage = stageRef.current;
      if (!stage) return;
      instanceRef.current = game.mount(stage, {
        locale,
        dir,
        seed,
        t: (key, values) => fill(ui[key] ?? key, values),
        settings: {
          volume: VOLUME,
          haptics: true,
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        },
        storage,
        ...(setup ? { match: setup } : {}),
        report: (event) => {
          if (event.type === "turn") {
            setReport((previous) => {
              warnLowTime(previous, event, setup);
              return event;
            });
          } else if (event.type === "finish") {
            setResult(event.result);
            setPhase("finished");
          }
        },
      });
      setPhase("playing");
    } catch {
      setPhase("error");
    }
  }

  /** Colour in the HUD, plus a sound and a buzz when a person's time runs low. */
  function warnLowTime(previous: TurnReport | null, next: TurnReport, setup: MatchSetup | null) {
    const started = next.lowTime.some(
      (low, seat) => low && !previous?.lowTime[seat] && setup?.seats[seat]?.kind === "human",
    );
    if (!started) return;
    lowTimeSoundRef.current ??= createLowTimeSound();
    lowTimeSoundRef.current.play("low");
    vibrate(HAPTICS.hit);
  }

  function openSetup(next: TurnMode) {
    if (!turn) return;
    setMode(next);
    setChoice(loadChoice(storage, turn.config, next));
    setResult(null);
    setPhase("setup");
    setMuted(isMuted());
    // Fetch the game's code while the player picks seats.
    void loadGame(id).then(
      () => {
        setCodeReady(true);
      },
      () => {
        setCodeReady(true);
      },
    );
  }

  function beginMatch() {
    if (!turn || !choice) return;
    saveChoice(storage, mode, choice);
    const seed = randomSeed();
    const setup = toMatch(
      choice,
      turn.config,
      { you: turn.strings.you, player: turn.strings.player },
      seed,
    );
    setMatch(setup);
    void mount(seed, setup);
  }

  function pause() {
    instanceRef.current?.pause();
    setPhase("paused");
  }
  function resume() {
    instanceRef.current?.resume();
    setPhase("playing");
  }
  function restart() {
    setResult(null);
    setReport(null);
    instanceRef.current?.restart(randomSeed());
    setPhase("playing");
  }
  function changeSetup() {
    instanceRef.current?.destroy();
    instanceRef.current = null;
    setResult(null);
    setReport(null);
    setPhase("setup");
  }
  function exit() {
    instanceRef.current?.destroy();
    instanceRef.current = null;
    setMatch(null);
    setReport(null);
    setPhase("idle");
  }

  // While open: no page scroll, screen stays awake, Escape pauses, tab
  // switches pause.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.style.overflow = "hidden";
    // Not every browser has the Wake Lock API.
    if ("wakeLock" in navigator) {
      void navigator.wakeLock.request("screen").then(
        (lock) => (wakeRef.current = lock),
        () => undefined,
      );
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (instanceRef.current) pauseRef.current?.click();
      }
    };
    const onHidden = () => {
      if (document.hidden && instanceRef.current) pauseRef.current?.click();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      root.style.overflow = "";
      void wakeRef.current?.release();
      wakeRef.current = null;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [open]);

  // Move focus to the overlay's main button when the pause menu, the results
  // or the setup screen opens (keyboard and screen-reader users land on it).
  useEffect(() => {
    if (phase === "paused" || phase === "finished" || phase === "setup") {
      overlayActionRef.current?.focus();
    }
  }, [phase]);

  // The game is torn down if the page unmounts mid-game.
  useEffect(
    () => () => {
      instanceRef.current?.destroy();
      lowTimeSoundRef.current?.dispose();
    },
    [],
  );

  const scoreText =
    result?.score !== undefined
      ? fill(strings.score, { score: result.score.toLocaleString(locale) })
      : null;
  const timeText =
    result?.timeMs !== undefined
      ? fill(strings.time, { time: formatDuration(result.timeMs) })
      : null;
  const headline =
    result && match && turn
      ? resultText(result, match.seats, match.mode, turn.strings, locale)
      : result?.completed
        ? strings.won
        : strings.gameOver;
  // Only when running out of time loses; a per-move timer that plays a random
  // move leaves a zero on the clock without ending the match.
  const losesOnTime =
    match?.timer.kind === "clock" ||
    (match?.timer.kind === "per-move" && match.timer.onExpiry === "loss");
  const timedOut =
    result && match && losesOnTime
      ? match.seats.find((_, i) => report?.clocks[i] === 0)
      : undefined;
  const showHud =
    match && turn && (phase === "playing" || phase === "paused" || phase === "finished");

  return (
    <>
      {turn ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          {turn.config.modes.map((m) => {
            const Icon = MODE_ICONS[m];
            return (
              <Button
                key={m}
                size="lg"
                variant={m === turn.config.modes[0] ? "primary" : "outline"}
                className="w-full sm:w-auto sm:min-w-48"
                onClick={() => {
                  openSetup(m);
                }}
              >
                <Icon aria-hidden="true" />
                {turn.strings.start[m]}
              </Button>
            );
          })}
        </div>
      ) : (
        <Button
          size="lg"
          className="w-full sm:w-auto sm:min-w-48"
          onClick={() => void mount(randomSeed(), null)}
        >
          <Play aria-hidden="true" />
          {strings.play}
        </Button>
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-label={name}
        hidden={!open}
        className="fixed inset-0 z-[70] flex flex-col bg-bg pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex min-h-14 items-center gap-2 border-b border-border bg-surface ps-[max(0.75rem,env(safe-area-inset-left))] pe-[max(0.75rem,env(safe-area-inset-right))]">
          <h2 className="min-w-0 flex-1 truncate text-lg">{name}</h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label={muted ? strings.unmute : strings.mute}
            aria-pressed={muted}
            onClick={() => {
              saveMuted(!muted);
              setMuted(!muted);
            }}
          >
            {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          </Button>
          <Button
            ref={pauseRef}
            variant="ghost"
            size="icon"
            aria-label={strings.pause}
            disabled={phase !== "playing"}
            onClick={pause}
          >
            <Pause aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon" aria-label={strings.exit} onClick={exit}>
            <X aria-hidden="true" />
          </Button>
        </div>

        {showHud && (
          <Suspense fallback={null}>
            <TurnHud
              seats={match.seats}
              timer={match.timer}
              report={report}
              strings={turn.strings}
            />
          </Suspense>
        )}

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-3">
          <div ref={stageRef} className="flex h-full w-full items-center justify-center" />

          {phase === "setup" && turn && choice && (
            <div className="absolute inset-0 z-10 overflow-auto bg-bg p-4">
              <Suspense fallback={null}>
                <TurnSetup
                  mode={mode}
                  config={turn.config}
                  choice={choice}
                  strings={turn.strings}
                  locale={locale}
                  loading={!codeReady}
                  startRef={overlayActionRef}
                  onChange={setChoice}
                  onStart={beginMatch}
                />
              </Suspense>
            </div>
          )}
          {phase === "loading" && (
            <p
              role="status"
              className="absolute inset-0 flex items-center justify-center gap-3 text-lg"
            >
              <LoaderCircle
                aria-hidden="true"
                className="size-6 animate-spin motion-reduce:animate-none"
              />
              {strings.loading}
            </p>
          )}
          {phase === "error" && (
            <Overlay>
              <p role="alert" className="text-lg">
                {strings.loadFailed}
              </p>
              <Button
                onClick={() => {
                  if (match) void mount(randomSeed(), match);
                  else void mount(randomSeed(), null);
                }}
              >
                {strings.retry}
              </Button>
            </Overlay>
          )}
          {phase === "paused" && (
            <Overlay>
              <p className="text-2xl font-semibold">{strings.paused}</p>
              <Button ref={overlayActionRef} onClick={resume}>
                {strings.resume}
              </Button>
              <Button variant="outline" onClick={restart}>
                {strings.restart}
              </Button>
              {turn && (
                <Button variant="outline" onClick={changeSetup}>
                  {turn.strings.changeSetup}
                </Button>
              )}
              <Button variant="ghost" onClick={exit}>
                {strings.exit}
              </Button>
            </Overlay>
          )}
          {phase === "finished" && (
            <Overlay>
              <p role="status" className="text-3xl font-semibold">
                {headline}
              </p>
              {timedOut && turn && (
                <p className="text-lg">
                  {fill(turn.strings.outOfTime, { name: seatName(timedOut, turn.strings) })}
                </p>
              )}
              {scoreText && <p className="text-xl tabular-nums">{scoreText}</p>}
              {timeText && <p className="text-lg tabular-nums">{timeText}</p>}
              <Button ref={overlayActionRef} onClick={restart}>
                {strings.playAgain}
              </Button>
              {turn && (
                <Button variant="outline" onClick={changeSetup}>
                  {turn.strings.changeSetup}
                </Button>
              )}
              <Button variant="ghost" onClick={exit}>
                {strings.exit}
              </Button>
            </Overlay>
          )}
        </div>
      </div>
    </>
  );
}

function createLowTimeSound() {
  return createSoundService({ low: "wood-block" }, () => VOLUME);
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-bg/90 p-6 text-center backdrop-blur-sm">
      {children}
    </div>
  );
}
