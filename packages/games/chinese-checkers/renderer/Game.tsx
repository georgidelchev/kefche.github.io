// Chinese Checkers board: the 121-hole star in SVG, each player's home
// point tinted in their colour. Tap one of your pieces, then a marked hole:
// a step or the end of a jump chain. The last move's path is traced. Arrow
// keys move between holes row by row; Enter picks. The board stays left to
// right in every language.
import { useState, useSyncExternalStore } from "react";

import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  SeatShape,
  seatStyle,
  useGridFocus,
  useTurnFeedback,
} from "@kefche/game-sdk/react";

import { EMPTY, engine, homeCount, HOLES, homeOf, reach, type Action, type State } from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

const SQ3 = Math.sqrt(3) / 2;
/** Screen position of a hole: rows of z, half a hole across per row. */
const pos = (i: number) => {
  const h = HOLES[i] ?? { x: 0, z: 0 };
  return [h.x + h.z / 2, h.z * SQ3] as const;
};
// The focus grid: rows of z, columns of 2x + z (every other column a hole).
const ROWS = 17;
const COLS = 33;
const CELL_OF = HOLES.map((h) => (h.z + 8) * COLS + (2 * h.x + h.z + 16));
const HOLE_AT = new Map(CELL_OF.map((cell, i) => [cell, i]));

/**
 * Arrow keys on the star: left and right to the next hole in the row; up and
 * down to the nearest hole in the row above or below (rows are offset by
 * half a hole, so a straight column would skip every other row).
 */
function starStep(key: string, cell: number): number | null {
  const r = Math.floor(cell / COLS);
  const c = cell % COLS;
  const inRow = (row: number) => [...HOLE_AT.keys()].filter((k) => Math.floor(k / COLS) === row);
  if (key === "ArrowLeft" || key === "ArrowRight") {
    const sign = key === "ArrowLeft" ? -1 : 1;
    const next = inRow(r)
      .filter((k) => ((k % COLS) - c) * sign > 0)
      .sort((a, b) => Math.abs((a % COLS) - c) - Math.abs((b % COLS) - c))[0];
    return next ?? cell;
  }
  if (key === "ArrowUp" || key === "ArrowDown") {
    const row = r + (key === "ArrowUp" ? -1 : 1);
    const next = inRow(row).sort((a, b) => Math.abs((a % COLS) - c) - Math.abs((b % COLS) - c))[0];
    return next ?? cell;
  }
  if (key === "Home" || key === "End") {
    const row = inRow(r).sort((a, b) => a - b);
    return (key === "Home" ? row[0] : row.at(-1)) ?? cell;
  }
  return null;
}

export function Game({ context, store, session, sounds }: Props) {
  const { t, match } = context;
  const seats = match?.seats.length ?? 2;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const [initial] = useState(() => engine.initialState(undefined, seats, context.seed));
  const state = view?.state ?? initial;
  const { board } = state;
  const [picked, setPicked] = useState<number | null>(null);
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";
  const human = view?.humanSeat ?? null;
  const targets = picked === null ? new Map<number, number[]>() : reach(state, picked);
  const movable = new Set(
    human === null
      ? []
      : board.flatMap((v, i) => (v === human && reach(state, i).size > 0 ? [i] : [])),
  );
  const homeArm = new Map(Array.from({ length: seats }, (_, s) => [homeOf(seats, s), s]));
  const path = state.last
    ? [state.last.from, ...(state.last.jumps.length > 0 ? state.last.jumps : [state.last.to])]
    : [];

  useTurnFeedback({
    context,
    view,
    moves: state.moves,
    sounds,
    onMove: (current) => {
      setPicked(null);
      sounds.play((current.state.last?.jumps.length ?? 0) > 0 ? "jump" : "step");
    },
  });

  const tap = (hole: number) => {
    if (human === null) return;
    if (board[hole] === human && movable.has(hole)) {
      setPicked(picked === hole ? null : hole);
      return;
    }
    if (picked !== null && targets.has(hole)) {
      const from = picked;
      setPicked(null);
      session.act(human, { from, to: hole });
    }
  };
  const grid = useGridFocus({
    cols: COLS,
    rows: ROWS,
    initial: CELL_OF[60] ?? 0,
    isCell: (cell) => HOLE_AT.has(cell),
    step: starStep,
    onActivate: (cell) => {
      const hole = HOLE_AT.get(cell);
      if (hole !== undefined) tap(hole);
    },
  });

  const label = (hole: number) => {
    const v = board[hole] ?? EMPTY;
    const h = HOLES[hole];
    const where = t("holeName", { row: (h?.z ?? 0) + 9, col: (h?.x ?? 0) + 9 });
    const base =
      v === EMPTY
        ? t("holeEmpty", { hole: where })
        : t("holePiece", { hole: where, name: name(v) });
    if (hole === picked) return `${base}, ${t("selected")}`;
    if (targets.has(hole)) return `${base}, ${t("target")}`;
    if (picked === null && movable.has(hole)) return `${base}, ${t("canMove")}`;
    return base;
  };
  const announcement = state.last
    ? t(state.last.jumps.length > 0 ? "jumped" : "stepped", {
        name: name(state.last.seat),
        count: state.last.jumps.length,
      })
    : "";

  const rows = Array.from({ length: ROWS }, (_, r) =>
    HOLES.flatMap((h, i) => (h.z + 8 === r ? [i] : [])),
  );
  const xs = HOLES.map((_, i) => pos(i)[0]);
  const ys = HOLES.map((_, i) => pos(i)[1]);
  const minX = Math.min(...xs) - 0.7;
  const minY = Math.min(...ys) - 0.7;
  const width = Math.max(...xs) - minX + 0.7;
  const height = Math.max(...ys) - minY + 0.7;

  return (
    <div className="gcc">
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <ul className="gcc-seats">
        {Array.from({ length: seats }, (_, s) => (
          <li
            key={s}
            style={seatStyle(s)}
            data-turn={!state.over && state.turn === s ? "" : undefined}
          >
            <span className="gcc-chip" aria-hidden="true">
              <SeatShape seat={s} />
            </span>
            {name(s)} <strong>{t("home", { count: homeCount(state, s) })}</strong>
          </li>
        ))}
      </ul>
      <svg
        className="gcc-board"
        viewBox={`${minX.toFixed(2)} ${minY.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}`}
        role="grid"
        aria-label={t("boardLabel")}
      >
        {path.length > 1 && (
          <polyline
            className="gcc-path"
            points={path
              .map((i) =>
                pos(i)
                  .map((v) => v.toFixed(2))
                  .join(","),
              )
              .join(" ")}
          />
        )}
        {Array.from({ length: ROWS }, (_, r) => (
          <g key={r} role="row">
            {(rows[r] ?? []).map((hole) => {
              const [x, y] = pos(hole);
              const v = board[hole] ?? EMPTY;
              const owner = homeArm.get(HOLES[hole]?.arm ?? -1);
              const focus = grid.cellProps(CELL_OF[hole] ?? 0);
              return (
                <g
                  key={hole}
                  ref={focus.ref}
                  tabIndex={focus.tabIndex}
                  onFocus={focus.onFocus}
                  onKeyDown={focus.onKeyDown}
                  role="gridcell"
                  aria-label={label(hole)}
                  className="gcc-hole"
                  data-target={targets.has(hole) ? "" : undefined}
                  data-movable={picked === null && movable.has(hole) ? "" : undefined}
                  data-picked={hole === picked ? "" : undefined}
                  onClick={() => {
                    tap(hole);
                  }}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={0.42}
                    className="gcc-pit"
                    style={owner === undefined ? undefined : seatStyle(owner)}
                    data-home={owner === undefined ? undefined : ""}
                  />
                  {v !== EMPTY && (
                    <g style={seatStyle(v)} className="gcc-piece">
                      <circle cx={x} cy={y} r={0.36} />
                      <svg x={x - 0.2} y={y - 0.2} width={0.4} height={0.4} viewBox="0 0 24 24">
                        <SeatShape seat={v} />
                      </svg>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        ))}
      </svg>
      <div className="gk-bar">
        {picked !== null && (
          <button
            type="button"
            className="gk-btn"
            onClick={() => {
              setPicked(null);
            }}
          >
            {t("cancel")}
          </button>
        )}
        {match?.mode === "solo-bots" && (
          <button
            type="button"
            className="gk-btn"
            disabled={!view?.canUndo}
            onClick={() => {
              setPicked(null);
              session.undo();
            }}
          >
            {t("undo")}
          </button>
        )}
      </div>
      <p className="gk-sr" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

const CSS = `
.gcc { display: grid; justify-items: center; gap: 0.6rem; width: 100%; user-select: none; -webkit-user-select: none; }
.gcc-seats { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.3rem 0.9rem; margin: 0; padding: 0; list-style: none; font-size: 0.9rem; }
.gcc-seats li { display: flex; align-items: center; gap: 0.35rem; padding: 0.1rem 0.5rem; border-radius: 999px; }
.gcc-seats li[data-turn] { box-shadow: 0 0 0 2px var(--fill); }
.gcc-seats strong { color: var(--muted); font-weight: 600; font-variant-numeric: tabular-nums; }
.gcc-chip { display: grid; place-items: center; width: 1.3rem; height: 1.3rem; border-radius: 50%; background: var(--fill); }
.gcc-chip svg { width: 60%; height: 60%; fill: var(--ink); }
.gcc-board { direction: ltr; width: min(100%, 36rem, calc((100dvh - 14rem) * 1.15)); height: auto; touch-action: manipulation; overflow: visible; }
.gcc-pit { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 0.04; }
.gcc-pit[data-home] { fill: color-mix(in srgb, var(--fill) 30%, var(--surface-2)); }
.gcc-hole[data-movable], .gcc-hole[data-target], .gcc-hole[data-picked] { cursor: pointer; }
.gcc-hole[data-target] .gcc-pit { stroke: var(--text); stroke-width: 0.1; stroke-dasharray: 0.12 0.08; }
.gcc-hole:focus { outline: none; }
.gcc-hole:focus-visible .gcc-pit { stroke: var(--focus); stroke-width: 0.14; }
.gcc-piece circle { fill: var(--fill); stroke: rgb(0 0 0 / 0.4); stroke-width: 0.04; }
.gcc-piece path { fill: var(--ink); opacity: 0.85; }
.gcc-hole[data-movable] .gcc-piece circle { stroke: var(--text); stroke-width: 0.07; }
.gcc-hole[data-picked] .gcc-piece circle { stroke: var(--text); stroke-width: 0.14; }
.gcc-path { fill: none; stroke: var(--muted); stroke-width: 0.09; stroke-dasharray: 0.18 0.12; stroke-linecap: round; stroke-linejoin: round; }
`;
