// Color Clash: a menu with the best on this device, a 3-2-1 countdown,
// then 30 seconds of words. Each word is a colour's name printed in an ink
// colour, large and bold on a dark panel; four buttons below, each with
// its colour as a swatch and its name, always in the same order: pick the
// ink. Keys 1 to 4 pick too. Picks are timed by their own events.
//
// The four inks were chosen to stay apart for every kind of colour
// blindness (the dataviz validator: worst pair ΔE 11 under deuteranopia,
// 18 for normal vision, all at least 3:1 on the panel for large text):
// the colour is the test here, so it has to be readable by everyone.
// Pausing calls the run off; it starts over after the countdown.
import { createElement, useEffect, useEffectEvent, useRef, useState } from "react";

import { HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  mountPuzzle,
  PuzzleMenu,
  SPEED_CSS,
  SpeedPad,
  useCountdown,
  usePuzzle,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";

import { COLOURS, DURATION_MS, engine, type Colour, type State } from "../engine";
import { createSounds, type Sounds } from "./sounds";

const timeKey = () => "30s";

/** The inks (fixed in both themes, on a dark panel). */
const INK: Record<Colour, string> = {
  red: "#D55E00",
  blue: "#56B4E9",
  green: "#009E73",
  yellow: "#F0E442",
};
/** Literal keys for the colour names (translations are checked by key). */
const NAME_KEYS: Record<Colour, string> = {
  red: "colourRed",
  blue: "colourBlue",
  green: "colourGreen",
  yellow: "colourYellow",
};

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
  const name = (c: Colour) => t(NAME_KEYS[c]);
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
  const [run, setRun] = useState(0);
  const [live, setLive] = useState(false);
  const [held, setHeld] = useState(false);
  // The first word's timestamp (performance.now()'s clock).
  const startRef = useRef<number | null>(null);
  const [left, setLeft] = useState(DURATION_MS);
  const [last, setLast] = useState<"right" | "wrong" | null>(null);
  const count = useCountdown(playing && !live && !held ? run : null, 3, () => {
    setLive(true);
  });

  function restart() {
    setLive(false);
    setRun((r) => r + 1);
    setLeft(DURATION_MS);
    setLast(null);
    startRef.current = null;
  }

  function pick(colour: number, at: number) {
    if (!state || !playing || !live || handle.paused || startRef.current === null) return;
    const ms = Math.round(at - startRef.current);
    const next = puzzle.dispatch({ pick: colour, ms: Math.min(ms, DURATION_MS) });
    if (!next) return;
    const right = next.right > state.right;
    setLast(right ? "right" : "wrong");
    sounds.play(right ? "right" : "wrong");
    vibrate(right ? HAPTICS.tap : HAPTICS.hit, context.settings.haptics);
  }

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const n = ["1", "2", "3", "4"].indexOf(event.key);
    if (n < 0) return;
    event.preventDefault();
    pick(n, event.timeStamp);
  });
  useEffect(() => {
    if (!playing) return;
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [playing]);

  // Each frame: start the clock on the first word's frame, count down, and
  // stop at 30 s; call the run off while paused.
  const frame = useEffectEvent((time: number) => {
    if (!state || !playing) return;
    if (handle.paused) {
      if (!held) {
        setHeld(true);
        if (state.index > 0) puzzle.start(undefined);
        restart();
      }
      return;
    }
    if (held) setHeld(false);
    if (!live) return;
    startRef.current ??= time;
    const gone = time - startRef.current;
    setLeft(Math.max(0, DURATION_MS - gone));
    if (gone >= DURATION_MS) {
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
        title={t("chooseTitle")}
        choices={[{ config: undefined, label: t("start"), detail: t("startDetail") }]}
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
  const trial = state.trials[state.index];
  const word = trial ? COLOURS[trial.word] : undefined;
  const ink = trial ? COLOURS[trial.ink] : undefined;
  return (
    <div className="gk gcc">
      <style>{KIT_CSS + SPEED_CSS + CSS}</style>
      <div className="gk-hud">
        <span className="gk-stat">
          <span>{t("points")}</span> <strong>{state.points}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("timeLeft")}</span>{" "}
          <strong>{t("seconds", { s: Math.ceil(left / 1000) })}</strong>
        </span>
      </div>
      {puzzle.screen === "over" ? (
        <Summary state={state} context={context} newBest={puzzle.newBest} />
      ) : (
        <>
          <div
            className="gcc-bar"
            role="progressbar"
            aria-label={t("timeLeft")}
            aria-valuemin={0}
            aria-valuemax={DURATION_MS / 1000}
            aria-valuenow={Math.ceil(left / 1000)}
          >
            <span style={{ inlineSize: `${String((left / DURATION_MS) * 100)}%` }} />
          </div>
          <div className="gcc-panel" data-last={last ?? undefined}>
            {count !== null ? (
              <span className="gk-count gcc-count">{count}</span>
            ) : word && ink ? (
              <span
                key={state.index}
                className="gcc-word"
                style={{ color: INK[ink] }}
                aria-label={t("wordIn", { word: name(word), ink: name(ink) })}
                role="img"
              >
                {name(word)}
              </span>
            ) : null}
          </div>
          <div className="gcc-picks" role="group" aria-label={t("pickLabel")}>
            {COLOURS.map((c, i) => (
              <SpeedPad
                key={c}
                className="gcc-pick"
                disabled={!live}
                onPress={(at) => {
                  pick(i, at);
                }}
              >
                <span className="gcc-swatch" style={{ background: INK[c] }} aria-hidden="true" />
                <span>{name(c)}</span>
                <kbd aria-hidden="true">{i + 1}</kbd>
              </SpeedPad>
            ))}
          </div>
        </>
      )}
      <p className="gk-sr" role="status">
        {count !== null
          ? String(count)
          : last === "right"
            ? t("right")
            : last === "wrong"
              ? t("wrong")
              : ""}
      </p>
    </div>
  );
}

function Summary({
  state,
  context,
  newBest,
}: {
  state: State;
  context: GameContext;
  newBest: boolean;
}) {
  const { t } = context;
  const answered = state.right + state.wrong;
  return (
    <div className="gcc-summary" role="status">
      <p className="gk-big">{t("pointsTotal", { n: state.points })}</p>
      <p>{t("rightWrong", { right: state.right, wrong: state.wrong })}</p>
      {answered > 0 && <p>{t("accuracy", { n: Math.round((state.right / answered) * 100) })}</p>}
      {newBest && <p>{t("newBest")}</p>}
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
.gcc { max-width: 36rem; margin-inline: auto; }
.gcc-bar { width: 100%; height: 0.6rem; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
.gcc-bar > span { display: block; height: 100%; background: var(--brand); }
.gcc-panel { display: grid; place-items: center; width: 100%; min-height: min(30dvh, 12rem); border-radius: 1rem; background: #1d2333; border: 3px solid transparent; }
.gcc-panel[data-last="wrong"] { border-color: #f87171; }
.gcc-word { font-size: clamp(2.5rem, 12vw, 4.5rem); font-weight: 900; letter-spacing: 0.02em; text-transform: uppercase; }
.gcc-count { color: #ffffff; }
.gcc-picks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.6rem; width: 100%; }
.gcc-pick { min-height: 4.5rem; grid-auto-flow: column; justify-content: start; gap: 0.75rem; padding-inline: 1rem; font-size: 1.05rem; }
.gcc-pick:disabled { opacity: 0.6; }
.gcc-swatch { width: 1.75rem; height: 1.75rem; border-radius: 50%; border: 2px solid var(--text); }
.gcc-pick kbd { margin-inline-start: auto; color: var(--text-muted); font-size: 0.8rem; font-family: inherit; }
.gcc-summary { display: grid; justify-items: center; gap: 0.35rem; text-align: center; }
.gcc-summary p { margin: 0; }
`;
