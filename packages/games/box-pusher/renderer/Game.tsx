// Box Pusher board: a menu of fresh levels by difficulty (with best times)
// and the 20 fixed levels of each (with best moves), then the warehouse.
// Arrow keys, WASD, a swipe on the board or the arrow pad step the player;
// a tap walks to a cell, or pushes the box beside the player. Z undoes and R
// restarts. The board stays left to right in every language.
import {
  createElement,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";

import {
  formatDuration,
  HAPTICS,
  vibrate,
  type GameContext,
  type GameStorage,
} from "@kefche/game-sdk/browser";
import {
  bestTime,
  KIT_CSS,
  mountPuzzle,
  usePuzzle,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";

import {
  configFrom,
  DIFFICULTIES,
  DIRS,
  engine,
  LEVELS,
  offset,
  solved,
  type Action,
  type Config,
  type Dir,
  type State,
} from "../engine";
import { createSounds, type Sounds } from "./sounds";

const timeKey = (config: Config) =>
  config.level > 0 ? `${config.difficulty}-${String(config.level)}` : config.difficulty;
const movesKey = (config: Config) => `moves:${config.difficulty}-${String(config.level)}`;
const bestMoves = (storage: GameStorage, config: Config) => {
  const n = Number(storage.get(movesKey(config)));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const KEYS: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};
const ARROW: Record<Dir, string> = { up: "↑", down: "↓", left: "←", right: "→" };

function Menu({ context, onPick }: { context: GameContext; onPick: (config: Config) => void }) {
  const { t } = context;
  const name = { easy: t("easy"), medium: t("medium"), hard: t("hard") };
  return (
    <div className="gk gk-menu gbp-menu">
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <h3 className="gk-title">{t("freshTitle")}</h3>
      {DIFFICULTIES.map((difficulty) => {
        const best = bestTime(context.storage, difficulty);
        return (
          <button
            key={difficulty}
            type="button"
            className="gk-choice"
            onClick={() => {
              onPick({ difficulty, level: 0 });
            }}
          >
            <span>{name[difficulty]}</span>
            {best !== null && <small>{t("best", { time: formatDuration(best) })}</small>}
          </button>
        );
      })}
      <h3 className="gk-title">{t("levelsTitle")}</h3>
      {DIFFICULTIES.map((difficulty) => (
        <section key={difficulty} className="gbp-tier" aria-label={name[difficulty]}>
          <h4>{name[difficulty]}</h4>
          <ol className="gbp-levels">
            {Array.from({ length: LEVELS }, (_, i) => {
              const config = { difficulty, level: i + 1 };
              const moves = bestMoves(context.storage, config);
              return (
                <li key={config.level}>
                  <button
                    type="button"
                    className="gbp-level"
                    data-solved={moves === null ? undefined : ""}
                    aria-label={
                      moves === null
                        ? t("levelLabel", { level: config.level })
                        : t("levelSolved", { level: config.level, moves })
                    }
                    onClick={() => {
                      onPick(config);
                    }}
                  >
                    {config.level}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
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
  const puzzle = usePuzzle({ context, seed, handle, engine, raceConfig: configFrom, timeKey });
  const [newMoves, setNewMoves] = useState(false);
  const swipeRef = useRef<{ x: number; y: number; cell: number | null } | null>(null);
  const state = puzzle.state;

  function act(action: Action) {
    const before = puzzle.state;
    const next = puzzle.dispatch(action);
    if (!next || !before) return;
    if (solved(next)) {
      sounds.play("win");
      vibrate(HAPTICS.win, context.settings.haptics);
      const config = next.config;
      const best = bestMoves(context.storage, config);
      if (!puzzle.racing && (best === null || next.trail.length < best)) {
        context.storage.set(movesKey(config), String(next.trail.length));
        setNewMoves(best !== null);
      }
      return;
    }
    const placed = (s: State) => s.level.goals.filter((g) => s.boxes.includes(g)).length;
    if (placed(next) > placed(before)) {
      sounds.play("goal");
      vibrate(HAPTICS.tap, context.settings.haptics);
    } else if (next.pushes > before.pushes) sounds.play("push");
    else if (action.type === "step" || action.type === "walk") sounds.play("step");
  }
  const step = (dir: Dir) => {
    act({ type: "step", dir });
  };

  // Keys work wherever the focus is in the game, except in a text field.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable]")) return;
    const dir = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (dir) step(dir);
    else if (e.key === "z" || e.key === "Z" || e.key === "Backspace") act({ type: "undo" });
    else if (e.key === "r" || e.key === "R") act({ type: "restart" });
    else return;
    e.preventDefault();
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      onKey(e);
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
    };
  }, []);

  if (puzzle.screen === "menu" || puzzle.screen === "failed") {
    return (
      <Menu
        context={context}
        onPick={(config) => {
          setNewMoves(false);
          puzzle.start(config);
        }}
      />
    );
  }
  if (!state) return null;
  const { level } = state;
  const { width, height, floor, goals } = level;
  const config = state.config;
  const onGoal = goals.filter((g) => state.boxes.includes(g)).length;
  const levelName =
    config.level > 0
      ? t("levelName", { difficulty: t(config.difficulty), level: config.level })
      : t("freshName", { difficulty: t(config.difficulty) });
  // Walls are drawn only beside the floor; the rest of the box is empty.
  const isWall = (x: number) => {
    if (floor[x]) return false;
    const r = Math.floor(x / width);
    const c = x % width;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < height && cc >= 0 && cc < width && floor[rr * width + cc]) return true;
      }
    }
    return false;
  };
  const cellAt = (e: PointerEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-cell]");
    return el ? Number(el.dataset.cell) : null;
  };
  const tapCell = (cell: number) => {
    const dir = DIRS.find((d) => state.player + offset(d, width) === cell);
    if (dir && state.boxes.includes(cell)) step(dir);
    else if (floor[cell] && !state.boxes.includes(cell)) act({ type: "walk", to: cell });
  };
  const over = puzzle.screen === "over";

  return (
    <div className="gk gbp">
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <div className="gk-hud">
        <span className="gk-chip">{levelName}</span>
        <span className="gk-stat">
          <span>{t("time")}</span> <strong>{formatDuration(puzzle.elapsedMs)}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("moves")}</span> <strong>{state.trail.length}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("pushes")}</span> <strong>{state.pushes}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("onGoals")}</span>{" "}
          <strong>{t("onGoalsCount", { placed: onGoal, total: goals.length })}</strong>
        </span>
      </div>
      <p className="gk-sr" aria-live="polite">
        {t("onGoalsStatus", { placed: onGoal, total: goals.length })}
      </p>
      <div
        className="gbp-board"
        role="group"
        aria-label={t("boardLabel")}
        aria-describedby="gbp-help"
        style={{ "--w": String(width), "--h": String(height) } as CSSProperties}
        onPointerDown={(e) => {
          swipeRef.current = { x: e.clientX, y: e.clientY, cell: cellAt(e) };
        }}
        onPointerUp={(e) => {
          const start = swipeRef.current;
          swipeRef.current = null;
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) > 24) {
            step(
              Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up",
            );
          } else if (start.cell !== null) tapCell(start.cell);
        }}
        onPointerCancel={() => {
          swipeRef.current = null;
        }}
      >
        {Array.from({ length: width * height }, (_, x) => {
          const wall = isWall(x);
          const goal = goals.includes(x);
          const box = state.boxes.includes(x);
          return (
            <div
              key={x}
              data-cell={x}
              className={floor[x] ? "gbp-floor" : wall ? "gbp-wall" : "gbp-void"}
            >
              {goal && <span className="gbp-goal" />}
              {box && <span className="gbp-box" data-placed={goal ? "" : undefined} />}
              {x === state.player && <span className="gbp-player" />}
            </div>
          );
        })}
      </div>
      <p id="gbp-help" className="gk-sr">
        {t("keysHelp")}
      </p>
      {over ? (
        <p role="status" className="gbp-done">
          {t("solvedIn", { moves: state.trail.length, pushes: state.pushes })}{" "}
          {puzzle.newBest ? t("newBest") : ""} {newMoves ? t("newBestMoves") : ""}
        </p>
      ) : (
        <div className="gbp-pad" role="group" aria-label={t("padLabel")}>
          {DIRS.map((dir) => (
            <button
              key={dir}
              type="button"
              className="gk-btn"
              data-dir={dir}
              aria-label={t(dir)}
              onClick={() => {
                step(dir);
              }}
            >
              {ARROW[dir]}
            </button>
          ))}
        </div>
      )}
      <div className="gbp-actions">
        {!over && (
          <>
            <button
              type="button"
              className="gk-btn"
              disabled={state.trail.length === 0}
              onClick={() => {
                act({ type: "undo" });
              }}
            >
              {t("undo")}
            </button>
            <button
              type="button"
              className="gk-btn"
              disabled={state.trail.length === 0}
              onClick={() => {
                act({ type: "restart" });
              }}
            >
              {t("restart")}
            </button>
            {!puzzle.racing && (
              <button type="button" className="gk-btn" onClick={puzzle.menu}>
                {t("chooseLevel")}
              </button>
            )}
          </>
        )}
      </div>
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
.gbp-board { direction: ltr; display: grid; grid-template-columns: repeat(var(--w), minmax(0, 1fr)); grid-template-rows: repeat(var(--h), minmax(0, 1fr)); width: min(100%, 30rem, calc((100dvh - 19rem) * var(--w) / var(--h))); aspect-ratio: var(--w) / var(--h); touch-action: none; user-select: none; border-radius: 0.5rem; }
.gbp-board:focus-visible { outline: 3px solid var(--focus, #2563eb); outline-offset: 3px; }
.gbp-board > div { position: relative; display: grid; place-items: center; }
.gbp-floor { background: #e9e2d0; }
.gbp-wall { background: #6b4f3a; box-shadow: inset 0 0 0 1px #4a3426; border-radius: 3px; }
.gbp-goal { position: absolute; width: 38%; aspect-ratio: 1; border-radius: 50%; border: 3px solid #b8460b; }
.gbp-box { position: absolute; inset: 9%; border-radius: 14%; background: #c98b3c; border: 3px solid #7a4d17; box-shadow: inset 0 0 0 3px #e0a95a; }
.gbp-box[data-placed] { background: #0f8a63; border-color: #075a40; box-shadow: inset 0 0 0 3px #3dbb8e; }
.gbp-box[data-placed]::after { content: "✓"; position: absolute; inset: 0; display: grid; place-items: center; color: #fff; font-weight: 800; font-size: clamp(0.7rem, 3.5vw, 1.3rem); }
.gbp-player { position: absolute; inset: 14%; border-radius: 50%; background: #1f5fae; border: 3px solid #0d3366; z-index: 1; }
.gbp-player::before { content: ""; position: absolute; top: 30%; left: 25%; width: 50%; height: 18%; background: radial-gradient(circle at 15% 50%, #fff 0 22%, transparent 24%), radial-gradient(circle at 85% 50%, #fff 0 22%, transparent 24%); }
.gbp-pad { direction: ltr; display: grid; grid-template-columns: repeat(3, 3rem); grid-template-areas: ". up ." "left down right"; gap: 0.3rem; justify-content: center; }
.gbp-pad [data-dir=up] { grid-area: up; } .gbp-pad [data-dir=down] { grid-area: down; } .gbp-pad [data-dir=left] { grid-area: left; } .gbp-pad [data-dir=right] { grid-area: right; }
.gbp-pad .gk-btn { min-height: 2.75rem; padding: 0; font-size: 1.2rem; }
.gbp-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }
.gbp-done { margin: 0; font-weight: 600; text-align: center; }
.gbp-menu { width: 100%; max-height: 100%; overflow-y: auto; overscroll-behavior: contain; }
.gbp-tier { width: 100%; }
.gbp-tier h4 { margin: 0.25rem 0; font-size: 0.9rem; }
.gbp-levels { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.35rem; }
.gbp-level { width: 100%; min-height: 2.75rem; border-radius: 0.5rem; border: 1px solid var(--border); background: var(--surface); color: var(--text); font: inherit; font-weight: 700; cursor: pointer; }
.gbp-level[data-solved] { background: color-mix(in srgb, #0f8a63 18%, var(--surface)); border-color: #0f8a63; }
.gbp-level[data-solved]::after { content: " ✓"; }
.gbp-level:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
`;
