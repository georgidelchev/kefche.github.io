// Dot Count: a menu with the best on this device, then ten rounds. Each
// round shows a field of dots for 1.2 s (on the frame it's drawn, the
// speed kit's clock), hides it, and asks how many; type the number on the
// keypad (or the keyboard: digits, Backspace, Enter). After each answer
// the dots come back with the count and the points, then the next round.
// Pausing during a showing shows that round again on return.
import { createElement, useEffect, useEffectEvent, useRef, useState } from "react";

import { HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  mountPuzzle,
  PuzzleMenu,
  SPEED_CSS,
  usePuzzle,
  useStimulus,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";

import { DOT_RADIUS, engine, FIELD, ROUNDS, score, SHOW_MS } from "../engine";
import { createSounds, type Sounds } from "./sounds";

const timeKey = () => "classic";
const READY_MS = 900;
const REVEAL_MS = 1600;
const KEYPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "ok"] as const;

/** "ready": about to show; "show": dots up; "answer": typing; "reveal": the count shown. */
type Phase = "ready" | "show" | "answer" | "reveal";

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
    raceConfig: () => undefined,
    timeKey,
    best: { order: "desc" },
  });
  const state = puzzle.state;
  const playing = puzzle.screen === "playing";
  const [phase, setPhase] = useState<Phase>("ready");
  const [typed, setTyped] = useState("");
  const [showing, setShowing] = useState(0);
  const sinceRef = useRef<number | null>(null);
  const shown = useStimulus(phase === "show" ? showing : null);

  function go(next: Phase) {
    sinceRef.current = null;
    if (next === "show") setShowing((n) => n + 1);
    setPhase(next);
  }

  function submit() {
    if (!state || phase !== "answer" || typed === "" || handle.paused) return;
    const next = puzzle.dispatch({ guess: Number(typed) });
    if (!next) return;
    const last = next.answers.at(-1);
    sounds.play(last?.points === 100 ? "exact" : (last?.points ?? 0) > 0 ? "close" : "far");
    vibrate(last?.points === 100 ? HAPTICS.win : HAPTICS.tap, context.settings.haptics);
    go("reveal");
  }

  function key(k: (typeof KEYPAD)[number]) {
    if (phase !== "answer") return;
    if (k === "ok") submit();
    else if (k === "back") setTyped((v) => v.slice(0, -1));
    else setTyped((v) => (v.length < 3 ? (v === "0" ? k : v + k) : v));
  }

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^[0-9]$/.test(event.key)) key(event.key as (typeof KEYPAD)[number]);
    else if (event.key === "Backspace") key("back");
    else if (event.key === "Enter") key("ok");
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
      if (phase === "show") go("ready");
      sinceRef.current = time;
      return;
    }
    sinceRef.current ??= time;
    const gone = time - sinceRef.current;
    if (phase === "ready" && gone >= READY_MS) go("show");
    else if (phase === "show" && (shown.since(time) ?? 0) >= SHOW_MS) {
      setTyped("");
      go("answer");
    } else if (phase === "reveal" && gone >= REVEAL_MS && state.answers.length < ROUNDS)
      go("ready");
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
        title={t("chooseTitle")}
        choices={[{ config: undefined, label: t("start"), detail: t("startDetail") }]}
        storage={context.storage}
        timeKey={timeKey}
        bestLabel={t("best", { n: "{time}" })}
        formatBest={(n) => t("best", { n })}
        onPick={(config) => {
          setTyped("");
          go("ready");
          puzzle.start(config);
        }}
      />
    );
  }
  if (!state) return null;
  const over = puzzle.screen === "over";
  const index = phase === "reveal" || over ? state.answers.length - 1 : state.answers.length;
  const round = state.rounds[index];
  const answer = state.answers[index];
  const showDots = phase === "show" || phase === "reveal" || over;
  return (
    <div className="gk gdc">
      <style>{KIT_CSS + SPEED_CSS + CSS}</style>
      <div className="gk-hud">
        <span className="gk-stat">
          <span>{t("round")}</span>{" "}
          <strong>{t("of", { n: Math.min(index + 1, ROUNDS), total: ROUNDS })}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("points")}</span> <strong>{score(state)}</strong>
        </span>
      </div>
      <svg
        className="gdc-field"
        viewBox={`0 0 ${String(FIELD)} ${String(FIELD)}`}
        role="img"
        aria-label={
          phase === "show"
            ? t("dotsShowing")
            : answer && round
              ? t("reveal", { n: round.dots.length, guess: answer.guess, points: answer.points })
              : t("fieldLabel")
        }
      >
        {showDots &&
          round?.dots.map(([x, y]) => (
            <circle
              key={`${String(x)},${String(y)}`}
              cx={x}
              cy={y}
              r={DOT_RADIUS}
              className="gdc-dot"
            />
          ))}
        {phase === "ready" && (
          <text
            x={FIELD / 2}
            y={FIELD / 2}
            className="gdc-ready"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {t("getReady")}
          </text>
        )}
      </svg>
      <p className="gdc-line" role="status">
        {over
          ? t("final", { n: score(state) })
          : phase === "reveal" && answer && round
            ? t("reveal", { n: round.dots.length, guess: answer.guess, points: answer.points })
            : phase === "answer"
              ? t("howMany")
              : ""}
      </p>
      {!over && (
        <div className="gdc-answer">
          <output className="gdc-typed" aria-label={t("yourAnswer")}>
            {typed === "" ? "–" : typed}
          </output>
          <div className="gdc-keys" role="group" aria-label={t("keypad")}>
            {KEYPAD.map((k) => (
              <button
                key={k}
                type="button"
                className="gk-btn gdc-key"
                disabled={phase !== "answer" || (k === "ok" && typed === "")}
                aria-label={k === "back" ? t("backspace") : k === "ok" ? t("ok") : undefined}
                onClick={() => {
                  key(k);
                }}
              >
                {k === "back" ? "⌫" : k === "ok" ? t("ok") : k}
              </button>
            ))}
          </div>
        </div>
      )}
      {over && puzzle.newBest && <p>{t("newBest")}</p>}
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

// The field is light in both themes, the dots dark on it (15:1).
const CSS = `
.gdc { max-width: 32rem; margin-inline: auto; }
.gdc-field { width: min(100%, calc(100dvh - 30rem), 24rem); aspect-ratio: 1; min-width: 12rem; border-radius: 1rem; background: #f8fafc; border: 2px solid #94a3b8; direction: ltr; }
.gdc-dot { fill: #1d2333; }
.gdc-ready { fill: #475569; font-size: 64px; font-weight: 700; }
.gdc-line { margin: 0; min-height: 1.5rem; font-weight: 700; text-align: center; }
.gdc-answer { display: grid; justify-items: center; gap: 0.5rem; width: 100%; }
.gdc-typed { min-width: 6rem; padding: 0.2rem 0.75rem; border-radius: 0.6rem; background: var(--surface-2); font-size: 1.75rem; font-weight: 800; text-align: center; font-variant-numeric: tabular-nums; }
.gdc-keys { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.4rem; width: min(100%, 16rem); direction: ltr; }
.gdc-key { min-height: 2.75rem; font-size: 1.15rem; padding-inline: 0; }
`;
