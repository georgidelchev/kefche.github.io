// Nonogram board: a menu of sizes with the best time of each, then the
// grid with its clues above the columns and beside the rows (as headers, so
// screen readers read them). Tap a cell to fill it, or switch to Cross to
// mark cells you know are empty; tap again to clear. Arrow keys move,
// Enter fills and X crosses. A clue dims once its line matches.
import { createElement, useState, type CSSProperties } from "react";

import { formatDuration, HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  mountPuzzle,
  PuzzleMenu,
  useGridFocus,
  usePuzzle,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";

import { clueOf, configFrom, engine, SIZES, type Config, type State } from "../engine";
import { createSounds, type Sounds } from "./sounds";

const timeKey = (config: Config) => String(config.size);

const lineDone = (state: State, cells: number[], clue: number[]) => {
  const runs = clueOf(cells.map((i) => (state.marks[i] === 1 ? 1 : 0)));
  return runs.length === clue.length && runs.every((r, i) => r === clue[i]);
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
  const puzzle = usePuzzle({ context, seed, handle, engine, raceConfig: configFrom, timeKey });
  const [cross, setCross] = useState(false);
  const state = puzzle.state;
  const size = state?.size ?? 10;

  function mark(cell: number, asCross = cross) {
    if (!state) return;
    const current = state.marks[cell] ?? 0;
    const wanted = asCross ? 2 : 1;
    const next = puzzle.dispatch({ cell, mark: current === wanted ? 0 : wanted });
    if (!next) return;
    if (engine.result(next)) {
      sounds.play("win");
      vibrate(HAPTICS.win, context.settings.haptics);
    } else {
      sounds.play(next.marks[cell] === 1 ? "fill" : "cross");
      vibrate(HAPTICS.tap, context.settings.haptics);
    }
  }
  const grid = useGridFocus({
    cols: size,
    rows: size,
    initial: 0,
    onActivate: (cell) => {
      mark(cell);
    },
  });

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
  if (!state) return null;
  const rowCells = (r: number) => Array.from({ length: size }, (_, c) => r * size + c);
  const colCells = (c: number) => Array.from({ length: size }, (_, r) => r * size + c);
  const clueText = (clue: number[]) => (clue.length === 0 ? "0" : clue.join(" "));
  return (
    <div className="gk gng">
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <div className="gk-hud">
        <span className="gk-chip">{t("sizeLabel", { size })}</span>
        <span className="gk-stat">
          <span>{t("time")}</span> <strong>{formatDuration(puzzle.elapsedMs)}</strong>
        </span>
        <button
          type="button"
          className="gk-btn"
          aria-pressed={!cross}
          onClick={() => {
            setCross(false);
          }}
        >
          {t("fill")}
        </button>
        <button
          type="button"
          className="gk-btn"
          aria-pressed={cross}
          onClick={() => {
            setCross(true);
          }}
        >
          {t("cross")}
        </button>
      </div>
      <div
        className="gng-board"
        role="grid"
        aria-label={t("boardLabel")}
        style={{ "--n": String(size) } as CSSProperties}
      >
        <div role="row" className="gng-row">
          <span role="presentation" className="gng-corner" />
          {state.colClues.map((clue, c) => (
            <span
              // eslint-disable-next-line @eslint-react/no-array-index-key -- columns are positional
              key={c}
              role="columnheader"
              aria-label={t("colClue", { col: c + 1, clue: clueText(clue) })}
              className="gng-col-clue"
              data-done={lineDone(state, colCells(c), clue) ? "" : undefined}
            >
              {(clue.length === 0 ? [0] : clue).map((n, i) => (
                // eslint-disable-next-line @eslint-react/no-array-index-key -- a clue's runs are positional
                <span key={i}>{n}</span>
              ))}
            </span>
          ))}
        </div>
        {state.rowClues.map((clue, r) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- rows are positional
          <div key={r} role="row" className="gng-row">
            <span
              role="rowheader"
              aria-label={t("rowClue", { row: r + 1, clue: clueText(clue) })}
              className="gng-row-clue"
              data-done={lineDone(state, rowCells(r), clue) ? "" : undefined}
            >
              {clueText(clue)}
            </span>
            {rowCells(r).map((cell) => {
              const focus = grid.cellProps(cell);
              const m = state.marks[cell] ?? 0;
              return (
                <span
                  key={cell}
                  ref={focus.ref}
                  tabIndex={focus.tabIndex}
                  onFocus={focus.onFocus}
                  onKeyDown={(e) => {
                    if (e.key === "x" || e.key === "X") {
                      e.preventDefault();
                      mark(cell, true);
                      return;
                    }
                    focus.onKeyDown(e);
                  }}
                  role="gridcell"
                  aria-label={t(m === 1 ? "cellFilled" : m === 2 ? "cellCrossed" : "cellEmpty", {
                    row: r + 1,
                    col: (cell % size) + 1,
                  })}
                  className="gng-cell"
                  data-mark={m === 1 ? "fill" : m === 2 ? "cross" : undefined}
                  data-edge-r={(cell % size) % 5 === 4 && cell % size !== size - 1 ? "" : undefined}
                  data-edge-b={r % 5 === 4 && r !== size - 1 ? "" : undefined}
                  onClick={() => {
                    mark(cell);
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      {puzzle.screen === "over" && (
        <p role="status" className="gng-done">
          {t("solved")} {puzzle.newBest ? t("newBest") : ""}
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
.gng-board { direction: ltr; display: grid; grid-template-rows: auto repeat(var(--n), minmax(0, 1fr)); width: min(100%, 34rem, calc(100dvh - 14rem)); padding: 4px; border-radius: 0.6rem; background: var(--surface-2); box-sizing: border-box; touch-action: manipulation; }
.gng-row { display: grid; grid-template-columns: minmax(2.2rem, auto) repeat(var(--n), minmax(0, 1fr)); }
.gng-col-clue { display: flex; flex-direction: column; justify-content: flex-end; align-items: center; padding-bottom: 3px; font-size: clamp(0.55rem, 2vw, 0.8rem); font-weight: 700; line-height: 1.15; font-variant-numeric: tabular-nums; }
.gng-row-clue { display: flex; align-items: center; justify-content: flex-end; padding-inline-end: 4px; font-size: clamp(0.55rem, 2vw, 0.8rem); font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
.gng-col-clue[data-done], .gng-row-clue[data-done] { color: var(--muted); text-decoration: line-through; }
.gng-cell { position: relative; aspect-ratio: 1; background: var(--surface); box-shadow: inset 0 0 0 0.5px var(--border-strong); cursor: pointer; }
.gng-cell[data-edge-r] { box-shadow: inset 0 0 0 0.5px var(--border-strong), inset -2px 0 0 var(--text); }
.gng-cell[data-edge-b] { box-shadow: inset 0 0 0 0.5px var(--border-strong), inset 0 -2px 0 var(--text); }
.gng-cell[data-edge-r][data-edge-b] { box-shadow: inset 0 0 0 0.5px var(--border-strong), inset -2px -2px 0 var(--text); }
.gng-cell[data-mark="fill"] { background: var(--text); }
.gng-cell[data-mark="cross"]::after { content: "×"; position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); font-weight: 700; line-height: 1; }
.gng-cell:focus-visible { outline: 3px solid var(--focus); outline-offset: -1px; z-index: 1; }
.gng-done { margin: 0; font-weight: 700; }
`;
