// Snake: a settings menu (speed, walls or wrap-around), then the Canvas
// board, steered by swipes, arrow keys / WASD or the on-screen D-pad (shown
// on touch screens). The game waits for the first direction before moving.
// In a race (context.race) the room's settings skip the menu, the snake
// sets off at once (everyone starts together) and keeps going while the tab
// is hidden (the race's clock doesn't stop), and every tick and turn is
// recorded.
import { useEffect, useRef, useState } from "react";

import {
  createCanvasStage,
  createLoop,
  HAPTICS,
  onDirectionKeys,
  onSwipe,
  onThemeChange,
  vibrate,
  type GameContext,
  type GameStorage,
} from "@kefche/game-sdk/browser";

import {
  COLS,
  engine,
  ROWS,
  SPEEDS,
  stepMs,
  type Config,
  type Direction,
  type Speed,
  type State,
} from "../engine";
import { drawBoard, readColors } from "./draw";

import type { Sounds } from "./sounds";

export interface GameHandle {
  paused: boolean;
}

interface Props {
  context: GameContext;
  seed: string;
  handle: GameHandle;
  sounds: Sounds;
  /** Skip the menu and play again with the last settings (restart). */
  quickStart: boolean;
}

const SETTINGS_KEY = "settings";
const SPEED_KEYS = { slow: "slow", normal: "normal", fast: "fast" } as const satisfies Record<
  Speed,
  string
>;
const bestKey = (config: Config) => `best:${config.speed}:${config.walls ? "walls" : "wrap"}`;

function loadSettings(storage: GameStorage): Config {
  try {
    const data: unknown = JSON.parse(storage.get(SETTINGS_KEY) ?? "null");
    if (typeof data === "object" && data !== null) {
      const { speed, walls } = data as Record<string, unknown>;
      const known = SPEEDS.find((s) => s === speed);
      if (known && typeof walls === "boolean") return { speed: known, walls };
    }
  } catch {
    // Falls back to the defaults.
  }
  return { speed: "normal", walls: true };
}

const bestScore = (storage: GameStorage, config: Config) =>
  Math.max(0, Number(storage.get(bestKey(config))) || 0);

/** A race's settings, from the room (anything unexpected plays the defaults). */
function raceConfig(context: GameContext): Config | null {
  if (!context.race) return null;
  const { speed, walls } = (context.race.config ?? {}) as Record<string, unknown>;
  return { speed: SPEEDS.find((s) => s === speed) ?? "normal", walls: walls !== false };
}

export function Game({ context, seed, handle, sounds, quickStart }: Props) {
  const { t, storage } = context;
  // A race skips the menu: the room chose the settings.
  const [config, setConfig] = useState(() => raceConfig(context) ?? loadSettings(storage));
  const [playing, setPlaying] = useState(quickStart || context.race !== undefined);

  if (playing) {
    return <Board context={context} seed={seed} handle={handle} sounds={sounds} config={config} />;
  }

  const choose = (next: Config) => {
    setConfig(next);
    storage.set(SETTINGS_KEY, JSON.stringify(next));
  };
  const best = bestScore(storage, config);
  return (
    <div className="gsnk gsnk-menu">
      <style>{CSS}</style>
      <fieldset>
        <legend>{t("speed")}</legend>
        <div className="gsnk-segments">
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              aria-pressed={config.speed === speed}
              onClick={() => {
                choose({ ...config, speed });
              }}
            >
              {t(SPEED_KEYS[speed])}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>{t("edges")}</legend>
        <div className="gsnk-segments">
          {([true, false] as const).map((walls) => (
            <button
              key={String(walls)}
              type="button"
              aria-pressed={config.walls === walls}
              onClick={() => {
                choose({ ...config, walls });
              }}
            >
              {walls ? t("walls") : t("wrap")}
            </button>
          ))}
        </div>
      </fieldset>
      <button
        type="button"
        className="gsnk-start"
        onClick={() => {
          setPlaying(true);
        }}
      >
        {t("start")}
      </button>
      {best > 0 && <p className="gsnk-best">{t("best", { score: best })}</p>}
    </div>
  );
}

// D-pad buttons: an arrow pointing up, rotated per direction.
const DPAD = [
  { direction: "up", rotate: 0 },
  { direction: "left", rotate: 270 },
  { direction: "right", rotate: 90 },
  { direction: "down", rotate: 180 },
] as const satisfies readonly { direction: Direction; rotate: number }[];

function Board({
  context,
  seed,
  handle,
  sounds,
  config,
}: Omit<Props, "quickStart"> & { config: Config }) {
  const { t, storage } = context;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  // Set by the game effect; the D-pad buttons call it.
  const turnRef = useRef<(direction: Direction) => void>(() => undefined);
  const [score, setScore] = useState(0);
  // A race starts everyone at the same moment: no waiting for a first turn.
  const [waiting, setWaiting] = useState(context.race === undefined);
  const [best] = useState(() => bestScore(storage, config));

  useEffect(() => {
    const canvas = canvasRef.current;
    const board = boardRef.current;
    if (!canvas || !board) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let state: State = engine.initialState(config, seed);
    // The state before the last step: frames between steps glide from it.
    let previous = state;
    let started = false;
    let lastAlpha = 1;
    let colors = readColors(board);

    // Called by the stage while it is set up and on every resize, so it uses
    // the canvas context directly. `alpha` (0–1) is how far the snake is
    // between the last step and the current one, so it moves every frame.
    const draw = (alpha = lastAlpha) => {
      lastAlpha = alpha;
      drawBoard(ctx, state, previous, alpha, colors);
    };

    const stage = createCanvasStage(canvas, COLS, ROWS, draw);

    const finish = () => {
      loop.stop();
      draw(1);
      const previous = bestScore(storage, config);
      if (state.score > previous) storage.set(bestKey(config), String(state.score));
      sounds.play(state.won ? "win" : "lose");
      vibrate(state.won ? HAPTICS.win : HAPTICS.lose, context.settings.haptics);
      context.report({ type: "finish", result: { score: state.score, completed: state.won } });
    };

    const loop = createLoop({
      stepMs: stepMs(state),
      step: () => {
        // The player's pause stops the loop at once (and the snake mid-glide);
        // the resumer below starts it again.
        if (handle.paused) {
          loop.pause();
          return;
        }
        const eaten = state.eaten;
        previous = state;
        context.race?.record({ type: "tick" });
        state = engine.apply(state, { type: "tick" });
        loop.setStep(stepMs(state));
        if (state.eaten !== eaten) {
          setScore(state.score);
          context.report({ type: "score", score: state.score });
          if (!state.over) sounds.play("eat");
          vibrate(HAPTICS.tap, context.settings.haptics);
        }
        if (state.over) finish();
      },
      render: (alpha) => {
        // Freeze mid-glide the moment the player pauses.
        if (handle.paused) loop.pause();
        else draw(alpha);
      },
      background: context.race !== undefined,
    });

    const turn = (direction: Direction) => {
      if (handle.paused || state.over) return;
      const before = state;
      context.race?.record({ type: "turn", direction });
      state = engine.apply(state, { type: "turn", direction });
      // Only a turn the snake will take makes a sound.
      if (state !== before) sounds.play("turn");
      if (!started) {
        started = true;
        setWaiting(false);
        loop.start();
      }
    };
    turnRef.current = turn;
    if (context.race) {
      started = true;
      loop.start();
    }

    // Outside a race the loop pauses itself when the tab is hidden; after the
    // player's Resume it picks up again here.
    const resumer = setInterval(() => {
      if (started && !state.over && !handle.paused && !loop.running) loop.resume();
    }, 100);
    const offKeys = onDirectionKeys(turn);
    const offSwipe = onSwipe(board, turn);
    // Theme changes recolor the board while it waits or after the game.
    const offTheme = onThemeChange(() => {
      colors = readColors(board);
      draw();
    });

    return () => {
      clearInterval(resumer);
      loop.stop();
      stage.dispose();
      offKeys();
      offSwipe();
      offTheme();
    };
  }, [config, seed, handle, context, storage, sounds]);

  return (
    <div className="gsnk">
      <style>{CSS}</style>
      <div className="gsnk-hud">
        <span className="gsnk-stat">
          <span>{t("score")}</span> <strong>{score}</strong>
        </span>
        <span className="gsnk-stat">
          <span>{t("bestLabel")}</span> <strong>{Math.max(best, score)}</strong>
        </span>
        <span className="gsnk-chip">
          {t(SPEED_KEYS[config.speed])} · {config.walls ? t("walls") : t("wrap")}
        </span>
      </div>
      <div
        ref={boardRef}
        className="gsnk-board"
        data-walls={config.walls ? "" : undefined}
        role="img"
        aria-label={t("boardLabel", { score })}
      >
        <div className="gsnk-canvas">
          <canvas ref={canvasRef} />
        </div>
        {waiting && <p className="gsnk-hint">{t("startHint")}</p>}
      </div>
      <div className="gsnk-dpad" role="group" aria-label={t("controlsLabel")}>
        {DPAD.map(({ direction, rotate }) => (
          <button
            key={direction}
            type="button"
            data-dir={direction}
            aria-label={t(direction)}
            onPointerDown={(e) => {
              e.preventDefault();
              turnRef.current(direction);
            }}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" style={{ rotate: `${String(rotate)}deg` }}>
              <path d="M12 5v14M5 12l7-7 7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

// Scoped by the gsnk- prefix; surfaces use the site's tokens. The board and
// the D-pad are physical directions, so they stay left-to-right everywhere.
// The race's mini boards (gsnk-mini) use the same board, with thinner edges.
export const CSS = `
.gsnk { --gsnk-size: min(100%, 32rem, calc(100dvh - 12rem)); display: grid; justify-items: center; gap: 0.75rem; width: 100%; max-width: 32rem; margin-inline: auto; user-select: none; -webkit-user-select: none; }
.gsnk button { font: inherit; }
.gsnk button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.gsnk-menu { max-width: 22rem; justify-items: stretch; gap: 1rem; }
.gsnk fieldset { margin: 0; padding: 0; border: 0; display: grid; gap: 0.4rem; }
.gsnk legend { padding: 0; margin-bottom: 0.4rem; font-weight: 700; }
.gsnk-segments { display: flex; gap: 0.35rem; padding: 0.3rem; border-radius: 0.9rem; background: var(--surface-2); }
.gsnk-segments button { flex: 1; min-height: 2.75rem; border: 0; border-radius: 0.65rem; background: transparent; color: var(--text); font-weight: 600; cursor: pointer; }
.gsnk-segments button[aria-pressed="true"] { background: var(--surface); box-shadow: 0 1px 3px rgb(0 0 0 / 0.18); }
.gsnk-start { min-height: 3.25rem; border: 0; border-radius: 0.9rem; background: var(--brand); color: var(--on-brand); font-size: 1.1rem; font-weight: 700; cursor: pointer; }
.gsnk-best { margin: 0; text-align: center; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.gsnk-hud { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 1rem; width: var(--gsnk-size); font-size: 0.9rem; }
.gsnk-stat span { color: var(--text-muted); }
.gsnk-stat strong { font-size: 1.1rem; font-variant-numeric: tabular-nums; }
.gsnk-chip { margin-inline-start: auto; padding: 0.2rem 0.65rem; border-radius: 999px; background: var(--surface-2); font-weight: 600; }
.gsnk-board { position: relative; direction: ltr; display: grid; place-items: center; width: var(--gsnk-size); aspect-ratio: 1; border: 3px dashed var(--border-strong); border-radius: 0.5rem; overflow: hidden; touch-action: none; }
.gsnk-board[data-walls] { border: 3px solid var(--text); }
.gsnk-canvas { display: grid; place-items: center; width: 100%; height: 100%; }
.gsnk-canvas canvas { display: block; }
.gsnk-hint { position: absolute; inset-inline: 1rem; bottom: 12%; margin: 0; padding: 0.6rem 0.9rem; border-radius: 0.75rem; background: color-mix(in srgb, var(--surface) 88%, transparent); text-align: center; font-weight: 600; pointer-events: none; }
.gsnk-dpad { display: none; direction: ltr; grid-template-columns: repeat(3, 3.75rem); grid-template-rows: repeat(2, 3.25rem); gap: 0.35rem; }
.gsnk-dpad button { display: grid; place-items: center; border: 0; border-radius: 0.9rem; background: var(--surface-2); color: var(--text); cursor: pointer; touch-action: none; }
.gsnk-dpad button:active { background: var(--border-strong); }
.gsnk-dpad svg { width: 1.6rem; height: 1.6rem; fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
.gsnk-dpad [data-dir="up"] { grid-column: 2; grid-row: 1; }
.gsnk-dpad [data-dir="left"] { grid-column: 1; grid-row: 2; }
.gsnk-dpad [data-dir="down"] { grid-column: 2; grid-row: 2; }
.gsnk-dpad [data-dir="right"] { grid-column: 3; grid-row: 2; }
@media (pointer: coarse) {
  .gsnk { --gsnk-size: min(100%, 32rem, calc(100dvh - 19rem)); }
  .gsnk-dpad { display: grid; }
}
@media (pointer: coarse) and (orientation: landscape) and (max-height: 40rem) {
  .gsnk { --gsnk-size: min(calc(100dvh - 6.5rem), 30rem); grid-template-columns: auto auto; grid-template-areas: "board hud" "board dpad"; max-width: none; align-items: center; column-gap: 2rem; }
  .gsnk-board { grid-area: board; }
  .gsnk-hud { grid-area: hud; width: auto; align-self: end; }
  .gsnk-dpad { grid-area: dpad; align-self: start; }
}
.gsnk-mini { --gsnk-size: 100%; }
.gsnk-mini .gsnk-board { border-width: 2px; border-radius: 0.35rem; touch-action: auto; }
`;
