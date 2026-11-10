// Pipe Link board: a menu of sizes with the best time of each, then the
// grid of numbered dots. Drag from a dot (or the end of a pipe) through
// neighbouring cells to lay a pipe; drawing over another pipe cuts it. On
// the keyboard, press Enter on a dot to start, move with the arrow keys and
// press Enter again to finish. Each pipe is sent as one move when it's
// laid. Dots carry numbers as well as colours. The board stays left to right
// in every language.
import { createElement, useRef, useState, type CSSProperties, type PointerEvent } from "react";

import { formatDuration, HAPTICS, vibrate, type GameContext } from "@kefche/game-sdk/browser";
import {
  gridStep,
  KIT_CSS,
  mountPuzzle,
  PuzzleMenu,
  useGridFocus,
  usePuzzle,
  type PuzzleHandle,
} from "@kefche/game-sdk/react";

import { adjacent, configFrom, connected, engine, SIZES, type Config, type State } from "../engine";
import { createSounds, type Sounds } from "./sounds";

const timeKey = (config: Config) => String(config.size);
/** Okabe–Ito and friends: distinct for most colour vision, and each dot has a number too. */
const COLOURS = [
  "#e69f00",
  "#56b4e9",
  "#009e73",
  "#f0e442",
  "#0072b2",
  "#d55e00",
  "#cc79a7",
  "#999999",
  "#882255",
  "#44aa99",
  "#332288",
];

interface Draft {
  colour: number;
  cells: number[];
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
  const [draft, setDraft] = useState<Draft | null>(null);
  // Read by the handlers: several moves can arrive before React renders again.
  const draftRef = useRef<Draft | null>(null);
  const track = (d: Draft | null) => {
    draftRef.current = d;
    setDraft(d);
  };
  const state = puzzle.state;
  const size = state?.size ?? 6;

  const dotAt = (s: State, cell: number) => s.ends.findIndex(([a, b]) => a === cell || b === cell);
  const pathAt = (s: State, cell: number) => s.paths.findIndex((p) => p.includes(cell));

  /** Where a drag from `cell` starts: a dot, or a pipe's open end. */
  function begin(cell: number): Draft | null {
    if (!state) return null;
    const dot = dotAt(state, cell);
    if (dot >= 0) return { colour: dot, cells: [cell] };
    const k = pathAt(state, cell);
    if (k < 0 || connected(state, k)) return null;
    const path = state.paths[k] ?? [];
    return path.at(-1) === cell ? { colour: k, cells: path } : null;
  }
  function extend(d: Draft, cell: number): Draft {
    if (!state) return d;
    const at = d.cells.indexOf(cell);
    // Back over the pipe: shorten it to there.
    if (at >= 0) return { ...d, cells: d.cells.slice(0, at + 1) };
    const last = d.cells.at(-1) ?? -1;
    const [a, b] = state.ends[d.colour] ?? [-1, -1];
    const finished = d.cells.length > 1 && (last === a || last === b);
    if (finished || !adjacent(last, cell, size)) return d;
    const dot = dotAt(state, cell);
    if (dot >= 0 && dot !== d.colour) return d;
    return { ...d, cells: [...d.cells, cell] };
  }
  function commit(d: Draft | null) {
    track(null);
    if (!d) return;
    const next = puzzle.dispatch({ colour: d.colour, cells: d.cells });
    if (!next) return;
    if (engine.result(next)) {
      sounds.play("win");
      vibrate(HAPTICS.win, context.settings.haptics);
    } else if (connected(next, d.colour)) {
      sounds.play("join");
      vibrate(HAPTICS.tap, context.settings.haptics);
    } else sounds.play("lay");
  }

  const grid = useGridFocus({
    cols: size,
    rows: size,
    initial: 0,
    onActivate: (cell) => {
      if (draftRef.current) commit(draftRef.current);
      else track(begin(cell));
    },
    step: (key, index) => {
      const to = gridStep(key, index, size, size);
      if (to !== null && to !== index && draftRef.current && key.startsWith("Arrow"))
        track(extend(draftRef.current, to));
      return to;
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
  const paths = state.paths.map((p, k) => (draft?.colour === k ? draft.cells : p));
  const owner = new Map<number, number>();
  paths.forEach((p, k) => {
    for (const c of p) if (!owner.has(c)) owner.set(c, k);
  });
  const joined = state.ends.filter((_, k) => connected(state, k)).length;
  const cellOf = (e: PointerEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-cell]");
    return el ? Number(el.dataset.cell) : null;
  };
  const centre = (cell: number) => [(cell % size) + 0.5, Math.floor(cell / size) + 0.5] as const;
  const label = (cell: number) => {
    const where = t("cellName", { row: Math.floor(cell / size) + 1, col: (cell % size) + 1 });
    const dot = dotAt(state, cell);
    if (dot >= 0) return t("cellDot", { cell: where, number: dot + 1 });
    const k = owner.get(cell);
    return k === undefined
      ? t("cellEmpty", { cell: where })
      : t("cellPipe", { cell: where, number: k + 1 });
  };

  return (
    <div className="gk gpl">
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <div className="gk-hud">
        <span className="gk-chip">{t("sizeLabel", { size })}</span>
        <span className="gk-stat">
          <span>{t("time")}</span> <strong>{formatDuration(puzzle.elapsedMs)}</strong>
        </span>
        <span className="gk-stat">
          <span>{t("joined")}</span>{" "}
          <strong>{t("joinedCount", { joined, total: state.ends.length })}</strong>
        </span>
      </div>
      <div
        className="gpl-board"
        role="grid"
        aria-label={t("boardLabel")}
        style={{ "--n": String(size) } as CSSProperties}
        onPointerMove={(e) => {
          const d = draftRef.current;
          if (!d) return;
          const cell = cellOf(e);
          if (cell !== null) track(extend(d, cell));
        }}
        onPointerUp={() => {
          if (draftRef.current) commit(draftRef.current);
        }}
        onPointerCancel={() => {
          track(null);
        }}
      >
        <svg
          className="gpl-pipes"
          viewBox={`0 0 ${String(size)} ${String(size)}`}
          aria-hidden="true"
        >
          {paths.map((p, k) =>
            p.length > 1 ? (
              <polyline
                // eslint-disable-next-line @eslint-react/no-array-index-key -- colours are positional
                key={k}
                points={p.map((c) => centre(c).join(",")).join(" ")}
                style={{ stroke: COLOURS[k % COLOURS.length] }}
              />
            ) : null,
          )}
        </svg>
        {Array.from({ length: size }, (_, r) => (
          <div key={r} role="row" className="gpl-row">
            {Array.from({ length: size }, (__, c) => {
              const cell = r * size + c;
              const focus = grid.cellProps(cell);
              const dot = dotAt(state, cell);
              const k = owner.get(cell);
              return (
                <div
                  key={cell}
                  ref={focus.ref}
                  tabIndex={focus.tabIndex}
                  onFocus={focus.onFocus}
                  onKeyDown={(e) => {
                    // Escape drops the pipe being drawn; otherwise it pauses the game.
                    if (e.key === "Escape" && draftRef.current) {
                      e.stopPropagation();
                      e.preventDefault();
                      track(null);
                    } else focus.onKeyDown(e);
                  }}
                  role="gridcell"
                  aria-label={label(cell)}
                  data-cell={cell}
                  className="gpl-cell"
                  style={
                    k === undefined
                      ? undefined
                      : ({ "--c": COLOURS[k % COLOURS.length] } as CSSProperties)
                  }
                  data-filled={k === undefined ? undefined : ""}
                  onPointerDown={(e) => {
                    const d = begin(cell);
                    if (!d) return;
                    // Touch captures the pointer on this cell; moves are found by position.
                    e.currentTarget.releasePointerCapture(e.pointerId);
                    track(d);
                  }}
                >
                  {dot >= 0 && (
                    <span
                      className="gpl-dot"
                      style={{ "--c": COLOURS[dot % COLOURS.length] } as CSSProperties}
                      aria-hidden="true"
                    >
                      {dot + 1}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {draft && <p className="gpl-hint">{t("drawing", { number: draft.colour + 1 })}</p>}
      {puzzle.screen === "over" && (
        <p role="status" className="gpl-done">
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
.gpl-board { direction: ltr; position: relative; display: grid; grid-template-rows: repeat(var(--n), minmax(0, 1fr)); width: min(100%, 30rem, calc(100dvh - 15rem)); aspect-ratio: 1; border-radius: 0.6rem; background: #1d2333; overflow: hidden; touch-action: none; user-select: none; }
.gpl-row { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); }
.gpl-cell { position: relative; display: grid; place-items: center; box-shadow: inset 0 0 0 0.5px #39415a; }
.gpl-cell[data-filled] { background: color-mix(in srgb, var(--c) 22%, transparent); }
.gpl-cell:focus-visible { outline: 3px solid #fff; outline-offset: -3px; z-index: 2; }
.gpl-pipes { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; }
.gpl-pipes polyline { fill: none; stroke-width: 0.34; stroke-linecap: round; stroke-linejoin: round; }
.gpl-dot { position: relative; z-index: 2; display: grid; place-items: center; width: 72%; aspect-ratio: 1; border-radius: 50%; background: var(--c); color: #141826; font-weight: 800; font-size: clamp(0.7rem, 3.5vw, 1.2rem); box-shadow: 0 0 0 2px #141826; pointer-events: none; }
.gpl-hint, .gpl-done { margin: 0; font-weight: 600; text-align: center; }
`;
