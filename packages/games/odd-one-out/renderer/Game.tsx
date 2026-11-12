// Odd One Out: a menu with the best on this device, a 3-2-1 countdown,
// then 45 seconds of grids. Each grid is rings with a gap, all turned the
// same way but one; tap the odd one (or move with the arrow keys and press
// Enter or Space). A wrong tap flashes and takes 2 seconds off. The rings
// differ only in which way they're turned, never in colour. Taps are timed
// by their own events, from the frame that drew the first grid. Pausing
// starts the run over after the countdown.
import {
  createElement,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type PointerEvent,
} from "react";

import { HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  mountPuzzle,
  PuzzleMenu,
  SPEED_CSS,
  useCountdown,
  useGridFocus,
  usePuzzle,
  useStimulus,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";

import { deadline, DURATION_MS, engine, PENALTY_MS } from "../engine";
import { createSounds, type Sounds } from "./sounds";

const timeKey = () => "45s";

/** A ring with its gap facing `angle` degrees (0: up). */
function Ring({ angle }: { angle: number }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="goo-ring">
      <g transform={`rotate(${String(angle)} 24 24)`}>
        <path d="M 28.5 6.6 A 18 18 0 1 1 19.5 6.6" />
      </g>
    </svg>
  );
}

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
  const [run, setRun] = useState(0);
  const [live, setLive] = useState(false);
  const [held, setHeld] = useState(false);
  const [now, setNow] = useState(0);
  const [miss, setMiss] = useState<number | null>(null);
  const count = useCountdown(playing && !live && !held ? run : null, 3, () => {
    setLive(true);
  });
  // The run's clock starts on the frame that draws the first grid.
  const clock = useStimulus(playing && live ? run : null);
  const level = state ? state.levels[state.cleared] : undefined;
  const size = level?.size ?? 3;
  const grid = useGridFocus({ cols: size, rows: size, initial: 0, onActivate: () => undefined });

  useEffect(() => {
    if (miss === null) return;
    const timer = setTimeout(() => {
      setMiss(null);
    }, 400);
    return () => {
      clearTimeout(timer);
    };
  }, [miss]);

  function restart() {
    setLive(false);
    setRun((r) => r + 1);
    setNow(0);
    setMiss(null);
  }

  function tap(cell: number, at: number) {
    if (!state || !playing || !live || handle.paused) return;
    const ms = clock.since(at);
    if (ms === null) return;
    const next = puzzle.dispatch({ cell, ms });
    if (!next) return;
    if (next.cleared > state.cleared) {
      sounds.play("found");
      vibrate(HAPTICS.tap, context.settings.haptics);
      grid.setFocus(0);
    } else {
      setMiss(cell);
      sounds.play("wrong");
      vibrate(HAPTICS.hit, context.settings.haptics);
    }
  }

  const frame = useEffectEvent((time: number) => {
    if (!state || !playing) return;
    if (handle.paused) {
      if (!held) {
        setHeld(true);
        if (state.cleared > 0 || state.mistakes > 0) puzzle.start(undefined);
        restart();
      }
      return;
    }
    if (held) setHeld(false);
    if (!live) return;
    const ms = clock.since(time) ?? 0;
    setNow(ms);
    if (ms >= deadline(state)) {
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
  const over = puzzle.screen === "over";
  const left = Math.max(0, deadline(state) - now);
  return (
    <div className="gk goo">
      <style>{KIT_CSS + SPEED_CSS + CSS}</style>
      <div className="gk-hud">
        <span className="gk-stat">
          <span>{t("level")}</span> <strong>{state.cleared + (over ? 0 : 1)}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("timeLeft")}</span>{" "}
          <strong>{t("seconds", { s: Math.ceil(left / 1000) })}</strong>
        </span>
      </div>
      <div
        className="goo-bar"
        role="progressbar"
        aria-label={t("timeLeft")}
        aria-valuemin={0}
        aria-valuemax={DURATION_MS / 1000}
        aria-valuenow={Math.ceil(left / 1000)}
      >
        <span style={{ inlineSize: `${String((left / DURATION_MS) * 100)}%` }} />
      </div>
      {over ? (
        <div className="goo-summary" role="status">
          <p className="gk-big">{t("levelsTotal", { n: state.cleared })}</p>
          <p>{t("mistakesTotal", { n: state.mistakes })}</p>
          {puzzle.newBest && <p>{t("newBest")}</p>}
        </div>
      ) : (
        <div className="goo-wrap">
          {live && level ? (
            <div
              key={state.cleared}
              className="goo-grid"
              role="grid"
              aria-label={t("gridLabel", { n: size * size })}
              style={{ gridTemplateRows: `repeat(${String(size)}, 1fr)` }}
            >
              {Array.from({ length: size }, (_, r) => (
                <div
                  key={r}
                  role="row"
                  className="goo-row"
                  style={{ gridTemplateColumns: `repeat(${String(size)}, 1fr)` }}
                >
                  {Array.from({ length: size }, (__, c) => {
                    const cell = r * size + c;
                    const focus = grid.cellProps(cell);
                    return (
                      <div
                        key={cell}
                        ref={focus.ref}
                        tabIndex={focus.tabIndex}
                        onFocus={focus.onFocus}
                        role="gridcell"
                        aria-label={t("ringLabel", {
                          row: Math.floor(cell / size) + 1,
                          col: (cell % size) + 1,
                        })}
                        className="goo-cell"
                        data-miss={miss === cell ? "" : undefined}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            if (!event.repeat) tap(cell, event.timeStamp);
                          } else focus.onKeyDown(event);
                        }}
                        onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
                          if (event.button > 0) return;
                          event.preventDefault();
                          tap(cell, event.timeStamp);
                        }}
                      >
                        <Ring angle={cell === level.odd ? level.oddAngle : level.angle} />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <span className="gk-count goo-count" aria-hidden="true">
              {count ?? ""}
            </span>
          )}
        </div>
      )}
      <p className="gk-sr" role="status">
        {count !== null
          ? String(count)
          : miss !== null
            ? t("wrongTap", { s: PENALTY_MS / 1000 })
            : ""}
      </p>
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
.goo { max-width: 36rem; margin-inline: auto; }
.goo-bar { width: 100%; height: 0.6rem; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
.goo-bar > span { display: block; height: 100%; background: var(--brand); }
.goo-wrap { position: relative; display: grid; place-items: center; width: min(100%, max(calc(100dvh - 10rem), 16rem), 30rem); aspect-ratio: 1; }
.goo-row { display: grid; gap: 3%; }
.goo-grid { display: grid; gap: 3%; width: 100%; height: 100%; direction: ltr; touch-action: manipulation; user-select: none; -webkit-user-select: none; }
.goo-cell { display: grid; place-items: center; border-radius: 0.5rem; background: var(--surface); border: 1px solid var(--border); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.goo-cell:focus-visible { outline: 3px solid var(--focus); outline-offset: 1px; }
.goo-cell[data-miss] { background: var(--danger); }
.goo-cell[data-miss] .goo-ring path { stroke: var(--on-danger); }
.goo-ring { width: 78%; height: 78%; }
.goo-ring path { fill: none; stroke: var(--text); stroke-width: 6; stroke-linecap: butt; }
.goo-summary { display: grid; justify-items: center; gap: 0.35rem; text-align: center; }
.goo-summary p { margin: 0; }
`;
