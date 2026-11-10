// Hex board: an 11 × 11 rhombus of hexagons drawn in SVG, with each
// player's two edges in their colour. Tap a cell to place a stone; with a
// touch screen the first tap shows it and the second places it, since the
// cells are small on a phone. With the swap rule, the second player gets a
// Swap button for their first move. The board stays left to right in every
// language.
import { useState, useSyncExternalStore } from "react";

import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  SeatShape,
  seatStyle,
  useGridFocus,
  useTurnFeedback,
} from "@kefche/game-sdk/react";

import { EMPTY, engine, type Action, type Config, type State } from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  config: Config;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

const R = 1 / Math.sqrt(3);
const PAD = 0.9;
const LETTERS = "abcdefghijk";
const coarse = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

const centre = (cell: number, size: number) => {
  const r = Math.floor(cell / size);
  const c = cell % size;
  return [PAD + c + r / 2 + 0.5, PAD + R + r * 1.5 * R] as const;
};
const corner = (x: number, y: number, k: number, scale = 1) => {
  const a = (Math.PI / 180) * (60 * k - 90);
  return [x + R * scale * Math.cos(a), y + R * scale * Math.sin(a)] as const;
};
const hexPoints = (x: number, y: number, scale = 0.97) =>
  Array.from({ length: 6 }, (_, k) =>
    corner(x, y, k, scale)
      .map((v) => v.toFixed(3))
      .join(","),
  ).join(" ");

export function Game({ context, config, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const [initial] = useState(() => engine.initialState(config, 2, context.seed));
  const state = view?.state ?? initial;
  const { board, size } = state;
  const [aim, setAim] = useState<number | null>(null);
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";
  const human = view?.humanSeat ?? null;
  const canSwap =
    human !== null && engine.legalActions(state, human).some((a) => a.type === "swap");
  const chain = new Set(state.chain);
  const where = (cell: number) =>
    `${LETTERS[cell % size] ?? ""}${String(Math.floor(cell / size) + 1)}`;

  useTurnFeedback({
    context,
    view,
    moves: state.moves,
    sounds,
    onMove: () => {
      setAim(null);
      sounds.play("stone");
    },
  });

  const place = (cell: number) => {
    if (human === null || board[cell] !== EMPTY) return;
    setAim(null);
    session.act(human, { type: "play", cell });
  };
  const tap = (cell: number) => {
    if (human === null || board[cell] !== EMPTY) return;
    if (coarse() && aim !== cell) setAim(cell);
    else place(cell);
  };
  const grid = useGridFocus({
    cols: size,
    rows: size,
    initial: Math.floor((size * size) / 2),
    onActivate: place,
  });

  const width = 2 * PAD + size + (size - 1) / 2;
  const height = 2 * PAD + 2 * R + (size - 1) * 1.5 * R;
  // The rhombus' corners, just outside the outer cells.
  const [tlx, tly] = centre(0, size);
  const [trx, try_] = centre(size - 1, size);
  const [blx, bly] = centre((size - 1) * size, size);
  const [brx, bry] = centre(size * size - 1, size);
  const out = 0.62;
  const edge = (x1: number, y1: number, x2: number, y2: number, seat: number, key: string) => (
    <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} className="ghx-edge" style={seatStyle(seat)} />
  );
  const edges = [
    edge(tlx - out, tly - out, trx + out * 0.5, try_ - out, 0, "top"),
    edge(blx - out * 0.5, bly + out, brx + out, bry + out, 0, "bottom"),
    edge(tlx - out, tly - out, blx - out * 0.5, bly + out, 1, "left"),
    edge(trx + out * 0.5, try_ - out, brx + out, bry + out, 1, "right"),
  ];

  const label = (cell: number) => {
    const v = board[cell] ?? EMPTY;
    const base =
      v === EMPTY
        ? t("cellEmpty", { cell: where(cell) })
        : t("cellStone", { cell: where(cell), name: name(v) });
    return chain.has(cell) ? `${base}, ${t("inChain")}` : base;
  };
  const announcement = (() => {
    if (state.last === null) return "";
    const who = board[state.last] ?? 0;
    if (state.swapped && state.moves === 2) return t("swapped", { name: name(1) });
    const placed = t("placed", { name: name(who), cell: where(state.last) });
    return state.winner === null
      ? placed
      : `${placed} ${t("connected", { name: name(state.winner) })}`;
  })();

  return (
    <div className="ghx" data-motion={context.settings.reducedMotion ? "off" : "on"}>
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <ul className="ghx-goals">
        {[0, 1].map((seat) => (
          <li
            key={seat}
            style={seatStyle(seat)}
            data-turn={state.winner === null && state.turn === seat ? "" : undefined}
          >
            <span className="ghx-chip" aria-hidden="true">
              <SeatShape seat={seat} />
            </span>
            {t(seat === 0 ? "goalTopBottom" : "goalLeftRight", { name: name(seat) })}
          </li>
        ))}
      </ul>
      <svg
        className="ghx-board"
        viewBox={`0 0 ${width.toFixed(3)} ${height.toFixed(3)}`}
        role="grid"
        aria-label={t("boardLabel")}
      >
        {edges}
        {Array.from({ length: size }, (_, r) => (
          <g key={r} role="row">
            {Array.from({ length: size }, (__, c) => {
              const cell = r * size + c;
              const v = board[cell] ?? EMPTY;
              const [x, y] = centre(cell, size);
              const focus = grid.cellProps(cell);
              const shown = v === EMPTY && aim === cell && human !== null ? human : v;
              return (
                <g
                  key={cell}
                  ref={focus.ref}
                  tabIndex={focus.tabIndex}
                  onFocus={focus.onFocus}
                  onKeyDown={focus.onKeyDown}
                  role="gridcell"
                  aria-label={label(cell)}
                  className="ghx-cell"
                  data-playable={human !== null && v === EMPTY ? "" : undefined}
                  data-last={state.last === cell ? "" : undefined}
                  data-chain={chain.has(cell) ? "" : undefined}
                  style={
                    chain.has(cell) && state.winner !== null ? seatStyle(state.winner) : undefined
                  }
                  onClick={() => {
                    tap(cell);
                  }}
                >
                  <polygon points={hexPoints(x, y)} className="ghx-hex" />
                  {shown !== EMPTY && (
                    <g
                      style={seatStyle(shown)}
                      data-aim={v === EMPTY ? "" : undefined}
                      className="ghx-stone"
                    >
                      <circle cx={x} cy={y} r={R * 0.78} />
                      <svg
                        x={x - R * 0.42}
                        y={y - R * 0.42}
                        width={R * 0.84}
                        height={R * 0.84}
                        viewBox="0 0 24 24"
                      >
                        <SeatShape seat={shown} />
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
        {aim !== null && <p className="ghx-hint">{t("tapAgain")}</p>}
        {canSwap && (
          <button
            type="button"
            className="gk-btn"
            onClick={() => {
              session.act(human, { type: "swap" });
            }}
          >
            {t("swap")}
          </button>
        )}
        {match?.mode === "solo-bots" && (
          <button
            type="button"
            className="gk-btn"
            disabled={!view?.canUndo}
            onClick={() => {
              setAim(null);
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
.ghx { --ghx-size: min(100%, 44rem, calc((100dvh - 15rem) * 1.45)); display: grid; justify-items: center; gap: 0.6rem; width: 100%; user-select: none; -webkit-user-select: none; }
.ghx-goals { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.35rem 1rem; margin: 0; padding: 0; list-style: none; font-size: 0.9rem; }
.ghx-goals li { display: flex; align-items: center; gap: 0.4rem; padding: 0.1rem 0.5rem; border-radius: 999px; }
.ghx-goals li[data-turn] { box-shadow: 0 0 0 2px var(--fill); }
.ghx-chip { display: grid; place-items: center; width: 1.4rem; height: 1.4rem; border-radius: 50%; background: var(--fill); }
.ghx-chip svg { width: 60%; height: 60%; fill: var(--ink); }
.ghx-board { direction: ltr; width: var(--ghx-size); height: auto; touch-action: manipulation; overflow: visible; }
.ghx-edge { stroke: var(--fill); stroke-width: 0.28; stroke-linecap: round; }
.ghx-hex { fill: var(--surface-2); stroke: var(--border-strong); stroke-width: 0.04; }
.ghx-cell[data-playable] { cursor: pointer; }
.ghx-cell[data-playable]:hover .ghx-hex { fill: var(--surface); }
.ghx-cell:focus { outline: none; }
.ghx-cell:focus-visible .ghx-hex { stroke: var(--focus); stroke-width: 0.12; }
.ghx-stone circle { fill: var(--fill); stroke: rgb(0 0 0 / 0.35); stroke-width: 0.04; }
.ghx-stone path { fill: var(--ink); opacity: 0.8; }
.ghx-stone[data-aim] { opacity: 0.5; }
.ghx-cell[data-last] .ghx-stone circle { stroke: var(--text); stroke-width: 0.1; }
.ghx-cell[data-chain] .ghx-hex { fill: var(--fill); opacity: 0.45; }
.ghx-hint { margin: 0; font-weight: 600; }
`;
