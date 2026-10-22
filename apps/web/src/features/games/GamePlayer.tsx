// Full-screen game player (SPEC §9.1): loads the game's code when Play is
// pressed, mounts it, and owns the chrome around it: pause menu, mute, exit,
// results, screen wake lock. The game draws everything inside the stage.
import { LoaderCircle, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { randomSeed, type GameResult } from "@kefche/game-sdk";
import {
  formatDuration,
  isMuted,
  setMuted as saveMuted,
  type GameInstance,
} from "@kefche/game-sdk/browser";
import { Button } from "@kefche/ui/components/button";

import { loadGame } from "./loaders";

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
}

type Phase = "idle" | "loading" | "playing" | "paused" | "finished" | "error";

const fill = (template: string, values: Record<string, string | number> = {}) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );

export function GamePlayer({ id, name, locale, dir, strings, ui }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<GameResult | null>(null);
  const [muted, setMuted] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<GameInstance | null>(null);
  const pauseRef = useRef<HTMLButtonElement>(null);
  // The main button of the pause or results overlay, focused when it opens.
  const overlayActionRef = useRef<HTMLButtonElement>(null);
  const wakeRef = useRef<WakeLockSentinel | null>(null);

  const open = phase !== "idle";

  async function start() {
    setPhase("loading");
    setResult(null);
    setMuted(isMuted());
    try {
      const game = await loadGame(id);
      const stage = stageRef.current;
      if (!stage) return;
      instanceRef.current = game.mount(stage, {
        locale,
        dir,
        seed: randomSeed(),
        t: (key, values) => fill(ui[key] ?? key, values),
        settings: {
          // "Quiet", the owner's pick in the Phase 3 sound picker. A volume
          // slider arrives with the settings in Phase 16.
          volume: 0.22,
          haptics: true,
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        },
        storage: {
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
        },
        report: (event) => {
          if (event.type === "finish") {
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
    instanceRef.current?.restart(randomSeed());
    setPhase("playing");
  }
  function exit() {
    instanceRef.current?.destroy();
    instanceRef.current = null;
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

  // Move focus to the overlay's main button when the pause menu or the
  // results screen opens (keyboard and screen-reader users land on it).
  useEffect(() => {
    if (phase === "paused" || phase === "finished") overlayActionRef.current?.focus();
  }, [phase]);

  // The game is torn down if the page unmounts mid-game.
  useEffect(
    () => () => {
      instanceRef.current?.destroy();
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

  return (
    <>
      <Button size="lg" className="w-full sm:w-auto sm:min-w-48" onClick={() => void start()}>
        <Play aria-hidden="true" />
        {strings.play}
      </Button>

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

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-3">
          <div ref={stageRef} className="flex h-full w-full items-center justify-center" />

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
              <Button onClick={() => void start()}>{strings.retry}</Button>
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
              <Button variant="ghost" onClick={exit}>
                {strings.exit}
              </Button>
            </Overlay>
          )}
          {phase === "finished" && (
            <Overlay>
              <p role="status" className="text-3xl font-semibold">
                {result?.completed ? strings.won : strings.gameOver}
              </p>
              {scoreText && <p className="text-xl tabular-nums">{scoreText}</p>}
              {timeText && <p className="text-lg tabular-nums">{timeText}</p>}
              <Button ref={overlayActionRef} onClick={restart}>
                {strings.playAgain}
              </Button>
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

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-bg/90 p-6 text-center backdrop-blur-sm">
      {children}
    </div>
  );
}
