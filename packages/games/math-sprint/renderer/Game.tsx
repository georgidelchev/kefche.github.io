// Math Sprint: a menu of three levels with the best of each on this
// device, a 3-2-1 countdown, then 60 seconds of problems. Type each answer
// on the keypad or the keyboard (digits, Backspace, Enter); after each,
// the next problem shows at once with a note on the last one (right, or
// the right answer). The clock starts on the frame that draws the first
// problem; answers are timed by their own events. Pausing starts the run
// over after the countdown.
import { createElement, useEffect, useEffectEvent, useRef, useState } from "react";

import { HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  mountPuzzle,
  PuzzleMenu,
  SPEED_CSS,
  useCountdown,
  usePuzzle,
  useStimulus,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";

import {
  configFrom,
  DURATION_MS,
  engine,
  LEVELS,
  type Config,
  type Level,
  type Problem,
} from "../engine";
import { createSounds, type Sounds } from "./sounds";

const timeKey = (config: Config) => config.level;
const KEYPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "ok"] as const;
type Key = (typeof KEYPAD)[number];
/** Literal keys for the levels' names and descriptions. */
const LEVEL_KEYS: Record<Level, { name: string; detail: string }> = {
  easy: { name: "levelEasy", detail: "levelEasyDetail" },
  medium: { name: "levelMedium", detail: "levelMediumDetail" },
  hard: { name: "levelHard", detail: "levelHardDetail" },
};

const problemText = (p: Problem) => `${String(p.a)} ${p.op === "-" ? "−" : p.op} ${String(p.b)}`;

function Game({
  context,
  seed,
  handle,
  sounds,
}: {
  context: GameContext;
  seed: string;
  handle: PuzzleHandle;
  sounds: Sounds;
}) {
  const { t } = context;
  const puzzle = usePuzzle({
    context,
    seed,
    handle,
    engine,
    raceConfig: configFrom,
    timeKey,
    best: { order: "desc" },
  });
  const state = puzzle.state;
  const playing = puzzle.screen === "playing";
  const [run, setRun] = useState(0);
  const [live, setLive] = useState(false);
  const [held, setHeld] = useState(false);
  const [typed, setTyped] = useState("");
  const [now, setNow] = useState(0);
  const count = useCountdown(playing && !live && !held ? run : null, 3, () => {
    setLive(true);
  });
  const clock = useStimulus(playing && live ? run : null);

  function restart() {
    setLive(false);
    setRun((r) => r + 1);
    setTyped("");
    setNow(0);
  }

  function submit(at: number) {
    if (!state || !playing || !live || handle.paused || typed === "") return;
    const ms = clock.since(at);
    if (ms === null) return;
    const next = puzzle.dispatch({ answer: Number(typed), ms: Math.min(ms, DURATION_MS - 1) });
    if (!next) return;
    setTyped("");
    const right = next.right > state.right;
    sounds.play(right ? "right" : "wrong");
    vibrate(right ? HAPTICS.tap : HAPTICS.hit, context.settings.haptics);
  }

  function key(k: Key, at: number) {
    if (!live || puzzle.screen !== "playing") return;
    if (k === "ok") submit(at);
    else if (k === "back") setTyped((v) => v.slice(0, -1));
    else setTyped((v) => (v.length < 5 ? (v === "0" ? k : v + k) : v));
  }

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^[0-9]$/.test(event.key)) key(event.key as Key, event.timeStamp);
    else if (event.key === "Backspace") key("back", event.timeStamp);
    else if (event.key === "Enter") key("ok", event.timeStamp);
    else return;
    event.preventDefault();
  });
  useEffect(() => {
    if (!playing) return;
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [playing]);

  const frame = useEffectEvent((time: number) => {
    if (!state || !playing) return;
    if (handle.paused) {
      if (!held) {
        setHeld(true);
        if (state.index > 0) puzzle.start(configFrom({ level: state.level }));
        restart();
      }
      return;
    }
    if (held) setHeld(false);
    if (!live) return;
    const ms = clock.since(time) ?? 0;
    setNow(ms);
    if (ms >= DURATION_MS) {
      const next = puzzle.dispatch({ stop: true });
      if (next) sounds.play("end");
    }
  });
  const rafRef = useRef(0);
  useEffect(() => {
    if (!playing) return;
    const loop = (time: number) => {
      frame(time);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  if (puzzle.screen === "menu" || puzzle.screen === "failed") {
    return (
      <PuzzleMenu
        title={t("chooseLevel")}
        choices={LEVELS.map((level) => ({
          config: { level },
          label: t(LEVEL_KEYS[level].name),
          detail: t(LEVEL_KEYS[level].detail),
        }))}
        storage={context.storage}
        timeKey={timeKey}
        bestLabel={t("best", { n: "{time}" })}
        formatBest={(n) => t("best", { n })}
        onPick={(config) => {
          restart();
          puzzle.start(config);
        }}
      />
    );
  }
  if (!state) return null;
  const over = puzzle.screen === "over";
  const current = state.problems[state.index];
  const prev = state.answers.at(-1);
  const prevProblem = state.problems[state.index - 1];
  const left = Math.max(0, DURATION_MS - now);
  return (
    <div className="gk gms">
      <style>{KIT_CSS + SPEED_CSS + CSS}</style>
      <div className="gk-hud">
        <span className="gk-chip">{t(LEVEL_KEYS[state.level].name)}</span>
        <span className="gk-stat">
          <span>{t("right")}</span> <strong>{state.right}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("timeLeft")}</span>{" "}
          <strong>{t("seconds", { s: Math.ceil(left / 1000) })}</strong>
        </span>
      </div>
      {over ? (
        <div className="gms-summary" role="status">
          <p className="gk-big">{t("rightTotal", { n: state.right })}</p>
          <p>{t("wrongTotal", { n: state.wrong })}</p>
          {puzzle.newBest && <p>{t("newBest")}</p>}
        </div>
      ) : (
        <>
          <div
            className="gms-bar"
            role="progressbar"
            aria-label={t("timeLeft")}
            aria-valuemin={0}
            aria-valuemax={DURATION_MS / 1000}
            aria-valuenow={Math.ceil(left / 1000)}
          >
            <span style={{ inlineSize: `${String((left / DURATION_MS) * 100)}%` }} />
          </div>
          <div className="gms-problem" dir="ltr">
            {count !== null ? (
              <span className="gk-count">{count}</span>
            ) : current ? (
              <>
                <span>{problemText(current)} =</span>
                <output className="gms-typed" aria-label={t("yourAnswer")}>
                  {typed === "" ? "?" : typed}
                </output>
              </>
            ) : null}
          </div>
          <p className="gms-last" role="status">
            {prev && prevProblem
              ? prev.right
                ? t("wasRight", { problem: problemText(prevProblem), answer: prevProblem.answer })
                : t("wasWrong", { problem: problemText(prevProblem), answer: prevProblem.answer })
              : ""}
          </p>
          <div className="gms-keys" role="group" aria-label={t("keypad")}>
            {KEYPAD.map((k) => (
              <button
                key={k}
                type="button"
                className="gk-btn gms-key"
                disabled={!live || (k === "ok" && typed === "")}
                aria-label={k === "back" ? t("backspace") : k === "ok" ? t("ok") : undefined}
                onPointerDown={(event) => {
                  if (event.button > 0) return;
                  event.preventDefault();
                  key(k, event.timeStamp);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    key(k, event.timeStamp);
                  }
                }}
              >
                {k === "back" ? "⌫" : k === "ok" ? t("ok") : k}
              </button>
            ))}
          </div>
        </>
      )}
      {playing && !puzzle.racing && (
        <button type="button" className="gk-btn" onClick={puzzle.menu}>
          {t("quit")}
        </button>
      )}
    </div>
  );
}

export function mount(container: HTMLElement, context: GameContext) {
  const sounds = createSounds(context);
  sounds.preload();
  return mountPuzzle(
    container,
    context,
    (seed, handle) => createElement(Game, { context, seed, handle, sounds }),
    () => {
      sounds.dispose();
    },
  );
}

const CSS = `
.gms { max-width: 32rem; margin-inline: auto; }
.gms-bar { width: 100%; height: 0.6rem; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
.gms-bar > span { display: block; height: 100%; background: var(--brand); }
.gms-problem { display: flex; align-items: center; justify-content: center; gap: 0.75rem; min-height: 5.5rem; font-size: clamp(2rem, 9vw, 3rem); font-weight: 800; font-variant-numeric: tabular-nums; }
.gms-typed { min-width: 3ch; padding: 0 0.4rem; border-radius: 0.5rem; background: var(--surface-2); text-align: center; }
.gms-last { margin: 0; min-height: 1.5rem; color: var(--text-muted); text-align: center; }
.gms-keys { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.45rem; width: min(100%, 18rem); direction: ltr; }
.gms-key { min-height: 3.25rem; font-size: 1.3rem; padding-inline: 0; touch-action: manipulation; }
.gms-summary { display: grid; justify-items: center; gap: 0.35rem; text-align: center; }
.gms-summary p { margin: 0; }
`;
