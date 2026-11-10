// 15 Puzzle board: a menu of sizes with the best time of each, then the
// frame of tiles. Tap a tile in the gap's row or column to slide it (and
// the tiles between); arrow keys move the focus and Enter slides. In a race
// the room's size starts at once.
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

import { configFrom, engine, SIZES, slide, type Config } from "../engine";
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
  const size = puzzle.state?.size ?? 4;
  const grid = useGridFocus({
    cols: size,
    rows: size,
    initial: 0,
    onActivate: (cell) => {
      move(cell);
    },
  });

  function move(cell: number) {
    const next = puzzle.dispatch({ cell });
    if (!next) return;
    if (engine.result(next)) {
      sounds.play("win");
      vibrate(HAPTICS.win, context.settings.haptics);
    } else {
      sounds.play("slide");
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
  const movable = new Set(
    state.tiles.flatMap((_, cell) => (slide(state.tiles, size, cell) ? [cell] : [])),
  );
  const label = (cell: number) => {
    const n = state.tiles[cell] ?? 0;
    const where = t("cellName", { row: Math.floor(cell / size) + 1, col: (cell % size) + 1 });
    return n === 0
      ? t("gap", { cell: where })
      : t(movable.has(cell) ? "tileMovable" : "tile", { cell: where, number: n });
  };
  return (
    <div className="gk gft">
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <div className="gk-hud">
        <span className="gk-chip">{t("sizeLabel", { size })}</span>
        <span className="gk-stat">
          <span>{t("time")}</span> <strong>{formatDuration(puzzle.elapsedMs)}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("moves")}</span> <strong>{state.moves}</strong>
        </span>
      </div>
      <div
        className="gft-board"
        role="grid"
        aria-label={t("boardLabel")}
        style={{ "--n": String(size) } as CSSProperties}
      >
        {Array.from({ length: size }, (_, r) => (
          <div key={r} role="row" className="gft-row">
            {Array.from({ length: size }, (__, c) => {
              const cell = r * size + c;
              const n = state.tiles[cell] ?? 0;
              const focus = grid.cellProps(cell);
              return (
                <div
                  key={cell}
                  ref={focus.ref}
                  tabIndex={focus.tabIndex}
                  onFocus={focus.onFocus}
                  onKeyDown={focus.onKeyDown}
                  role="gridcell"
                  aria-label={label(cell)}
                  className="gft-cell"
                  data-gap={n === 0 ? "" : undefined}
                  data-home={n !== 0 && n === cell + 1 ? "" : undefined}
                  data-movable={movable.has(cell) ? "" : undefined}
                  onClick={() => {
                    move(cell);
                  }}
                >
                  {n === 0 ? "" : n}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {puzzle.screen === "over" && (
        <p role="status" className="gft-done">
          {t("solved", { moves: state.moves })} {puzzle.newBest ? t("newBest") : ""}
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
.gft-board { direction: ltr; display: grid; grid-template-rows: repeat(var(--n), minmax(0, 1fr)); gap: 2%; width: min(100%, 28rem, calc(100dvh - 16rem)); aspect-ratio: 1; padding: 2.5%; border-radius: 1rem; background: #3b4a6b; box-sizing: border-box; touch-action: manipulation; }
.gft-row { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 2%; }
.gft-cell { display: grid; place-items: center; border-radius: 0.6rem; background: #f3e2c4; color: #3b2414; font-weight: 800; font-size: clamp(1rem, 6vw, 2rem); font-variant-numeric: tabular-nums; box-shadow: inset 0 -4px 0 rgb(0 0 0 / 0.18); }
.gft-cell[data-gap] { background: transparent; box-shadow: none; }
.gft-cell[data-home] { background: #ffd58a; }
.gft-cell[data-movable] { cursor: pointer; }
.gft-cell:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
.gft-done { margin: 0; font-weight: 700; }
`;
