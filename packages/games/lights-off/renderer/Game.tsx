// Lights Off board: a menu of sizes with the best time of each, then the
// grid of lights. Tap a light (or move with the arrow keys and press Enter)
// to switch it and its neighbours. In a race the room's size starts at once.
import { createElement, type CSSProperties } from "react";

import { formatDuration, HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  mountPuzzle,
  PuzzleMenu,
  useGridFocus,
  usePuzzle,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";

import { configFrom, engine, SIZES, type Config } from "../engine";
import { createSounds, type Sounds } from "./sounds";

const timeKey = (config: Config) => String(config.size);

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
  const puzzle = usePuzzle({ context, seed, handle, engine, raceConfig: configFrom, timeKey });
  const size = puzzle.state?.size ?? 5;
  const grid = useGridFocus({
    cols: size,
    rows: size,
    initial: Math.floor((size * size) / 2),
    onActivate: (cell) => {
      press(cell);
    },
  });

  function press(cell: number) {
    const next = puzzle.dispatch({ cell });
    if (!next) return;
    if (engine.result(next)) {
      sounds.play("win");
      vibrate(HAPTICS.win, context.settings.haptics);
    } else {
      sounds.play(next.lights[cell] ? "on" : "off");
      vibrate(HAPTICS.tap, context.settings.haptics);
    }
  }

  if (puzzle.screen === "menu" || puzzle.screen === "failed") {
    return (
      <PuzzleMenu
        title={t("chooseSize")}
        choices={SIZES.map((s) => ({ config: { size: s }, label: t("sizeLabel", { size: s }) }))}
        storage={context.storage}
        timeKey={timeKey}
        bestLabel={t("best")}
        onPick={puzzle.start}
      />
    );
  }
  const state = puzzle.state;
  if (!state) return null;
  const lit = state.lights.reduce((n, v) => n + v, 0);
  return (
    <div className="gk glo">
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <div className="gk-hud">
        <span className="gk-chip">{t("sizeLabel", { size })}</span>
        <span className="gk-stat">
          <span>{t("time")}</span> <strong>{formatDuration(puzzle.elapsedMs)}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("presses")}</span> <strong>{state.presses}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("lit")}</span> <strong>{lit}</strong>
        </span>
      </div>
      <div
        className="glo-board"
        role="grid"
        aria-label={t("boardLabel")}
        style={{ "--n": String(size) } as CSSProperties}
      >
        {Array.from({ length: size }, (_, r) => (
          <div key={r} role="row" className="glo-row">
            {Array.from({ length: size }, (__, c) => {
              const cell = r * size + c;
              const on = state.lights[cell] === 1;
              const focus = grid.cellProps(cell);
              return (
                <div
                  key={cell}
                  ref={focus.ref}
                  tabIndex={focus.tabIndex}
                  onFocus={focus.onFocus}
                  onKeyDown={focus.onKeyDown}
                  role="gridcell"
                  aria-label={t(on ? "lightOn" : "lightOff", { row: r + 1, col: c + 1 })}
                  className="glo-light"
                  data-on={on ? "" : undefined}
                  onClick={() => {
                    press(cell);
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      {puzzle.screen === "over" && (
        <p role="status" className="glo-done">
          {t("solved", { presses: state.presses, fewest: state.fewest })}{" "}
          {puzzle.newBest ? t("newBest") : ""}
        </p>
      )}
      {puzzle.screen === "playing" && !puzzle.racing && (
        <button type="button" className="gk-btn" onClick={puzzle.menu}>
          {t("changeSize")}
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
.glo-board { direction: ltr; display: grid; grid-template-rows: repeat(var(--n), minmax(0, 1fr)); gap: 3%; width: min(100%, 28rem, calc(100dvh - 16rem)); aspect-ratio: 1; padding: 3%; border-radius: 1rem; background: #1d2333; box-sizing: border-box; touch-action: manipulation; }
.glo-row { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 3%; }
.glo-light { border-radius: 22%; background: #39415a; box-shadow: inset 0 -3px 0 rgb(0 0 0 / 0.35); cursor: pointer; }
.glo-light[data-on] { background: radial-gradient(circle at 40% 35%, #fff8d6, #ffd84a 55%, #e0a800); box-shadow: 0 0 14px #ffd84a88, inset 0 -3px 0 rgb(0 0 0 / 0.2); }
.glo-light:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
.glo-done { margin: 0; font-weight: 700; text-align: center; }
`;
