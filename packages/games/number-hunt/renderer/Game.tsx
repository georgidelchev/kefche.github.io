// Number Hunt: a menu with the best time on this device, a 3-2-1
// countdown, then the 5 × 5 grid of shuffled numbers; tap 1 to 25 in
// order. Found numbers fade, a wrong tap flashes and adds a second. The
// clock starts on the frame that draws the grid (the speed kit); taps are
// timed by their own events. The keyboard moves over the grid with the
// arrow keys and taps with Enter or Space. Pausing starts it over.
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

import { COUNT, engine, PENALTY_MS, score, SIZE, type State } from "../engine";
import { createSounds, type Sounds } from "./sounds";

const timeKey = () => "5x5";

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
  const { t, locale } = context;
  const seconds = (ms: number) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      ms / 1000,
    );
  const puzzle = usePuzzle({
    context,
    seed,
    handle,
    engine,
    raceConfig: () => undefined,
    timeKey,
    best: { order: "asc" },
  });
  const state = puzzle.state;
  const playing = puzzle.screen === "playing";
  const [run, setRun] = useState(0);
  const [live, setLive] = useState(false);
  const [held, setHeld] = useState(false);
  const [now, setNow] = useState(0);
  const [miss, setMiss] = useState<{ cell: number; key: number } | null>(null);
  const count = useCountdown(playing && !live && !held ? run : null, 3, () => {
    setLive(true);
  });
  const clock = useStimulus(playing && live ? run : null);
  const grid = useGridFocus({
    cols: SIZE,
    rows: SIZE,
    initial: 0,
    // Enter and Space are each cell's own (timed by the key's event, below).
    onActivate: () => undefined,
  });

  // A wrong tap's flash lasts a moment; the next one on the same cell flashes again.
  useEffect(() => {
    if (!miss) return;
    const timer = setTimeout(() => {
      setMiss(null);
    }, 450);
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
    if (next.next > state.next) {
      sounds.play(next.next > COUNT ? "win" : "found");
      vibrate(next.next > COUNT ? HAPTICS.win : HAPTICS.tap, context.settings.haptics);
    } else {
      setMiss({ cell, key: next.mistakes });
      sounds.play("wrong");
      vibrate(HAPTICS.hit, context.settings.haptics);
    }
  }

  const frame = useEffectEvent((time: number) => {
    if (!state || !playing) return;
    if (handle.paused) {
      if (!held) {
        setHeld(true);
        if (state.next > 1 || state.mistakes > 0) puzzle.start(undefined);
        restart();
      }
      return;
    }
    if (held) setHeld(false);
    if (live) setNow(clock.since(time) ?? 0);
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
        bestLabel={t("best", { time: "{time}" })}
        formatBest={(ms) => t("best", { time: seconds(ms) })}
        onPick={(config) => {
          restart();
          puzzle.start(config);
        }}
      />
    );
  }
  if (!state) return null;
  const done = puzzle.screen === "over";
  return (
    <div className="gk gnh">
      <style>{KIT_CSS + SPEED_CSS + CSS}</style>
      <div className="gk-hud">
        <span className="gk-stat">
          <span>{t("find")}</span> <strong>{done ? "✓" : state.next}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("time")}</span>{" "}
          <strong>{t("secondsShort", { s: seconds(done ? state.last : now) })}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("mistakes")}</span> <strong>{state.mistakes}</strong>
        </span>
      </div>
      {done ? (
        <Summary state={state} context={context} newBest={puzzle.newBest} seconds={seconds} />
      ) : (
        <div className="gnh-wrap">
          <div className="gnh-grid" role="grid" aria-label={t("gridLabel", { n: state.next })}>
            {Array.from({ length: SIZE }, (_, r) => (
              <div key={r} role="row" className="gnh-row">
                {Array.from({ length: SIZE }, (__, c) => {
                  const cell = r * SIZE + c;
                  const value = state.grid[cell] ?? 0;
                  const found = value < state.next;
                  const focus = grid.cellProps(cell);
                  return (
                    <div
                      key={cell}
                      ref={focus.ref}
                      tabIndex={focus.tabIndex}
                      onFocus={focus.onFocus}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          if (!event.repeat) tap(cell, event.timeStamp);
                        } else focus.onKeyDown(event);
                      }}
                      role="gridcell"
                      aria-label={found ? t("foundCell", { n: value }) : String(value)}
                      className="gnh-cell"
                      data-found={found ? "" : undefined}
                      data-miss={miss?.cell === cell ? String(miss.key) : undefined}
                      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
                        if (event.button > 0) return;
                        event.preventDefault();
                        tap(cell, event.timeStamp);
                      }}
                    >
                      {live ? value : ""}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {count !== null && (
            <span className="gnh-count gk-count" aria-hidden="true">
              {count}
            </span>
          )}
        </div>
      )}
      <p className="gk-sr" role="status">
        {count !== null ? String(count) : miss ? t("wrongTap", { s: PENALTY_MS / 1000 }) : ""}
      </p>
      {playing && !puzzle.racing && (
        <button type="button" className="gk-btn" onClick={puzzle.menu}>
          {t("quit")}
        </button>
      )}
    </div>
  );
}

function Summary({
  state,
  context,
  newBest,
  seconds,
}: {
  state: State;
  context: GameContext;
  newBest: boolean;
  seconds: (ms: number) => string;
}) {
  const { t } = context;
  return (
    <div className="gnh-summary" role="status">
      <p className="gk-big">{t("secondsShort", { s: seconds(score(state)) })}</p>
      <p>{t("timeAndPenalty", { time: seconds(state.last), n: state.mistakes })}</p>
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
.gnh { max-width: 36rem; margin-inline: auto; }
.gnh-wrap { position: relative; width: min(100%, calc(100dvh - 10rem), 30rem); aspect-ratio: 1; }
.gnh-grid { display: grid; grid-template-rows: repeat(5, 1fr); gap: 2%; width: 100%; height: 100%; direction: ltr; touch-action: manipulation; user-select: none; -webkit-user-select: none; }
.gnh-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2%; }
.gnh-cell { display: grid; place-items: center; border-radius: 0.6rem; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-size: clamp(1.1rem, 6vw, 1.9rem); font-weight: 800; font-variant-numeric: tabular-nums; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.gnh-cell[data-found] { background: var(--surface-2); color: var(--text-muted); border-style: dashed; }
.gnh-cell[data-miss] { animation: gnh-miss 400ms ease-out; }
.gnh-cell:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
@keyframes gnh-miss { from { background: var(--danger); color: var(--on-danger); } }
@media (prefers-reduced-motion: reduce) { .gnh-cell[data-miss] { animation: none; outline: 3px solid var(--danger); } }
.gnh-count { position: absolute; inset: 0; display: grid; place-items: center; }
.gnh-summary { display: grid; justify-items: center; gap: 0.35rem; text-align: center; }
.gnh-summary p { margin: 0; }
`;
