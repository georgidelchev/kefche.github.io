// Minesweeper board: a menu of levels with the best time of each, then the
// field. Tap a cell to reveal it; a long press, a right-click, F, or the
// flag mode marks a mine; tapping a number whose mines are all flagged
// reveals the rest around it. The first reveal is always safe; in a race
// it must be the marked cell, so everyone gets the same field.
import { createElement, useRef, useState, type CSSProperties } from "react";

import { formatDuration, HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  mountPuzzle,
  PuzzleMenu,
  useGridFocus,
  usePuzzle,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";

import {
  configFrom,
  countAround,
  engine,
  LEVEL_ORDER,
  LEVELS,
  type Action,
  type Config,
  type Level,
} from "../engine";
import { createSounds, type Sounds } from "./sounds";

const timeKey = (config: Config) => config.level;
const LONG_PRESS_MS = 450;
const LEVEL_KEYS = {
  beginner: "beginner",
  intermediate: "intermediate",
  expert: "expert",
} as const satisfies Record<Level, string>;

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
  const [flagMode, setFlagMode] = useState(false);
  const pressRef = useRef<{ timer: ReturnType<typeof setTimeout>; fired: boolean } | null>(null);
  const state = puzzle.state;
  const cols = state?.cols ?? 9;
  const rows = state?.rows ?? 9;

  function act(action: Action) {
    if (!state) return;
    if (puzzle.racing && state.mines.length === 0 && action.cell !== state.start) return;
    const next = puzzle.dispatch(action);
    if (!next) return;
    if (next.exploded !== null) {
      sounds.play("boom");
      vibrate(HAPTICS.lose, context.settings.haptics);
    } else if (next.won) {
      sounds.play("win");
      vibrate(HAPTICS.win, context.settings.haptics);
    } else {
      sounds.play(action.type === "flag" ? "flag" : "open");
      vibrate(HAPTICS.tap, context.settings.haptics);
    }
  }
  const primary = (cell: number) => {
    if (!state) return;
    if (state.open[cell]) act({ type: "chord", cell });
    else act({ type: flagMode ? "flag" : "reveal", cell });
  };
  const grid = useGridFocus({ cols, rows, initial: state?.start ?? 0, onActivate: primary });

  if (puzzle.screen === "menu" || puzzle.screen === "failed") {
    return (
      <PuzzleMenu
        title={t("chooseLevel")}
        choices={LEVEL_ORDER.map((level) => ({
          config: { level },
          label: t(LEVEL_KEYS[level]),
          detail: t("levelDetail", {
            cols: LEVELS[level].cols,
            rows: LEVELS[level].rows,
            mines: LEVELS[level].mines,
          }),
        }))}
        storage={context.storage}
        timeKey={timeKey}
        bestLabel={t("best")}
        onPick={puzzle.start}
      />
    );
  }
  if (!state) return null;
  const over = state.exploded !== null || state.won;
  const flagsLeft = state.count - state.flags.reduce((n, v) => n + v, 0);
  const label = (cell: number) => {
    const where = t("cellName", { row: Math.floor(cell / cols) + 1, col: (cell % cols) + 1 });
    if (state.open[cell]) {
      if (state.mines[cell]) return t("cellMine", { cell: where });
      const n = countAround(state.mines, cell, cols, rows);
      return n === 0 ? t("cellClear", { cell: where }) : t("cellNumber", { cell: where, count: n });
    }
    if (state.flags[cell]) return t("cellFlag", { cell: where });
    if (over && state.mines[cell]) return t("cellMine", { cell: where });
    if (state.mines.length === 0 && cell === state.start) return t("cellStart", { cell: where });
    return t("cellHidden", { cell: where });
  };

  return (
    <div className="gk gms">
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <div className="gk-hud">
        <span className="gk-chip">{t(LEVEL_KEYS[state.level])}</span>
        <span className="gk-stat">
          <span>{t("time")}</span> <strong>{formatDuration(puzzle.elapsedMs)}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("minesLeft")}</span> <strong>{flagsLeft}</strong>
        </span>
        <button
          type="button"
          className="gk-btn"
          aria-pressed={flagMode}
          onClick={() => {
            setFlagMode((f) => !f);
          }}
        >
          {t("flagMode")}
        </button>
      </div>
      <div
        className="gms-board"
        role="grid"
        aria-label={t("boardLabel")}
        style={{ "--cols": String(cols), "--rows": String(rows) } as CSSProperties}
      >
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} role="row" className="gms-row">
            {Array.from({ length: cols }, (__, c) => {
              const cell = r * cols + c;
              const focus = grid.cellProps(cell);
              const isOpen = state.open[cell] === 1;
              const mine = state.mines[cell] === 1;
              const n = isOpen && !mine ? countAround(state.mines, cell, cols, rows) : 0;
              const showMine = mine && (isOpen || over);
              return (
                <div
                  key={cell}
                  ref={focus.ref}
                  tabIndex={focus.tabIndex}
                  onFocus={focus.onFocus}
                  onKeyDown={(e) => {
                    if (e.key === "f" || e.key === "F") {
                      e.preventDefault();
                      act({ type: "flag", cell });
                      return;
                    }
                    focus.onKeyDown(e);
                  }}
                  role="gridcell"
                  aria-label={label(cell)}
                  className="gms-cell"
                  data-open={isOpen ? "" : undefined}
                  data-n={n > 0 ? String(n) : undefined}
                  data-flag={state.flags[cell] && !isOpen ? "" : undefined}
                  data-mine={showMine ? "" : undefined}
                  data-boom={state.exploded === cell ? "" : undefined}
                  data-start={state.mines.length === 0 && cell === state.start ? "" : undefined}
                  onPointerDown={(e) => {
                    if (e.pointerType !== "touch" || over) return;
                    const press = {
                      fired: false,
                      timer: setTimeout(() => {
                        press.fired = true;
                        act({ type: "flag", cell });
                      }, LONG_PRESS_MS),
                    };
                    pressRef.current = press;
                  }}
                  onPointerUp={() => {
                    if (pressRef.current) clearTimeout(pressRef.current.timer);
                  }}
                  onPointerLeave={() => {
                    if (pressRef.current) clearTimeout(pressRef.current.timer);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (!pressRef.current?.fired) act({ type: "flag", cell });
                  }}
                  onClick={() => {
                    const press = pressRef.current;
                    pressRef.current = null;
                    if (press?.fired) return;
                    primary(cell);
                  }}
                >
                  {n > 0 ? n : ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {state.mines.length === 0 && (
        <p className="gms-hint">{t(puzzle.racing ? "startRace" : "startHint")}</p>
      )}
      {puzzle.screen === "over" && (
        <p role="status" className="gms-done">
          {state.won ? t("cleared") : t("exploded")} {puzzle.newBest ? t("newBest") : ""}
        </p>
      )}
      {(puzzle.screen === "playing" || puzzle.screen === "over") && !puzzle.racing && (
        <button type="button" className="gk-btn" onClick={puzzle.menu}>
          {t("changeLevel")}
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
.gms-board { direction: ltr; display: grid; grid-template-rows: repeat(var(--rows), minmax(0, 1fr)); gap: 2px; width: min(100%, 34rem, calc((100dvh - 15rem) * var(--cols) / var(--rows))); aspect-ratio: var(--cols) / var(--rows); padding: 4px; border-radius: 0.6rem; background: #8a94a8; box-sizing: border-box; touch-action: manipulation; -webkit-touch-callout: none; }
.gms-row { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 2px; min-height: 0; }
.gms-cell { position: relative; display: grid; place-items: center; border-radius: 3px; background: #d7dce6; box-shadow: inset 0 -2px 0 #9aa3b5; font-weight: 800; font-size: clamp(0.7rem, 2.6vw, 1.1rem); font-variant-numeric: tabular-nums; line-height: 1; min-height: 0; overflow: hidden; cursor: pointer; }
.gms-cell[data-open] { background: #f4f6fa; box-shadow: none; cursor: default; }
.gms-cell[data-n="1"] { color: #1f5fbf; }
.gms-cell[data-n="2"] { color: #2e7d32; }
.gms-cell[data-n="3"] { color: #c62828; }
.gms-cell[data-n="4"] { color: #283593; }
.gms-cell[data-n="5"] { color: #6d4c41; }
.gms-cell[data-n="6"] { color: #00796b; }
.gms-cell[data-n="7"] { color: #37474f; }
.gms-cell[data-n="8"] { color: #424242; }
.gms-cell[data-flag]::after { content: ""; position: absolute; inset: 22% 26% 18% 34%; background: linear-gradient(#c62828, #c62828) left top / 70% 55% no-repeat, linear-gradient(#141826, #141826) left top / 2px 100% no-repeat; }
.gms-cell[data-mine]::after { content: ""; position: absolute; inset: 24%; border-radius: 50%; background: #141826; box-shadow: 0 0 0 2px #141826; }
.gms-cell[data-boom] { background: #ef9a9a; }
.gms-cell[data-start]::after { content: ""; position: absolute; inset: 30%; border-radius: 50%; border: 3px solid #2e7d32; }
.gms-cell:focus-visible { outline: 3px solid var(--focus); outline-offset: -1px; z-index: 1; }
.gms-hint, .gms-done { margin: 0; font-weight: 600; text-align: center; }
`;
