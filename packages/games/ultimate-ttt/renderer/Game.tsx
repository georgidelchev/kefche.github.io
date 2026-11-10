// Ultimate Tic-Tac-Toe board: nine small boards in a 3 × 3 grid, laid out
// as one 9 × 9 grid of cells for focus and screen readers. The boards you
// may play in are highlighted; a won board shows its winner's mark across
// it. Classic mode is a single 3 × 3 board. Marks are each seat's shape in
// its colour. The board stays left to right in every language.
import { useState, useSyncExternalStore, type CSSProperties } from "react";

import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  SeatShape,
  seatStyle,
  useGridFocus,
  useTurnFeedback,
} from "@kefche/game-sdk/react";

import { EMPTY, engine, movesFor, type Action, type Config, type State } from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  config: Config;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

/** The cell index at display row r and column c. */
const indexAt = (mode: State["mode"], r: number, c: number) =>
  mode === "classic"
    ? r * 3 + c
    : (Math.floor(r / 3) * 3 + Math.floor(c / 3)) * 9 + (r % 3) * 3 + (c % 3);

export function Game({ context, config, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const [initial] = useState(() => engine.initialState(config, 2, context.seed));
  const state = view?.state ?? initial;
  const { cells, boards, mode } = state;
  const size = mode === "classic" ? 3 : 9;
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";
  const human = view?.humanSeat ?? null;
  const legal = new Set(human === null ? [] : movesFor(state));
  const activeBoards = new Set([...movesFor(state)].map((i) => Math.floor(i / 9)));
  const line = new Set(state.line);

  useTurnFeedback({
    context,
    view,
    moves: state.moves,
    sounds,
    onMove: () => {
      sounds.play("mark");
    },
  });

  const play = (index: number) => {
    if (human === null || !legal.has(index)) return;
    session.act(human, { cell: index });
  };
  const grid = useGridFocus({
    cols: size,
    rows: size,
    initial: Math.floor((size * size) / 2),
    onActivate: (display) => {
      play(indexAt(mode, Math.floor(display / size), display % size));
    },
  });

  const where = (index: number) =>
    mode === "classic"
      ? t("cellClassic", { cell: index + 1 })
      : t("cellUltimate", { board: Math.floor(index / 9) + 1, cell: (index % 9) + 1 });
  const label = (index: number) => {
    const v = cells[index] ?? EMPTY;
    const base =
      v === EMPTY
        ? t("cellEmpty", { cell: where(index) })
        : t("cellMark", { cell: where(index), name: name(v) });
    return legal.has(index) ? `${base}, ${t("canPlay")}` : base;
  };
  const announcement = (() => {
    if (state.last === null) return "";
    const who = cells[state.last] ?? 0;
    const played = t("played", { name: name(who), cell: where(state.last) });
    if (mode === "classic") return played;
    const board = Math.floor(state.last / 9);
    const won = boards[board] === who ? t("wonBoard", { name: name(who), board: board + 1 }) : "";
    const next =
      state.over || state.next === null
        ? ""
        : boards[state.next] === EMPTY
          ? t("nextBoard", { board: state.next + 1 })
          : t("anyBoard");
    return [played, won, next].filter(Boolean).join(" ");
  })();
  // Ultimate: a spacer column and row between the small boards.
  const place = (r: number, c: number): CSSProperties =>
    mode === "classic"
      ? {}
      : { gridColumn: c + Math.floor(c / 3) + 1, gridRow: r + Math.floor(r / 3) + 1 };

  return (
    <div className="gut">
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <ul className="gut-seats">
        {[0, 1].map((seat) => (
          <li
            key={seat}
            style={seatStyle(seat)}
            data-turn={!state.over && state.turn === seat ? "" : undefined}
          >
            <span className="gut-chip" aria-hidden="true">
              <SeatShape seat={seat} />
            </span>
            {name(seat)}
          </li>
        ))}
      </ul>
      <div className="gut-board" role="grid" aria-label={t("boardLabel")} data-mode={mode}>
        {Array.from({ length: size }, (_, r) => (
          <div key={r} role="row" className="gut-row">
            {Array.from({ length: size }, (__, c) => {
              const index = indexAt(mode, r, c);
              const v = cells[index] ?? EMPTY;
              const focus = grid.cellProps(r * size + c);
              const board = Math.floor(index / 9);
              return (
                <div
                  key={index}
                  ref={focus.ref}
                  tabIndex={focus.tabIndex}
                  onFocus={focus.onFocus}
                  onKeyDown={focus.onKeyDown}
                  role="gridcell"
                  aria-label={label(index)}
                  className="gut-cell"
                  style={{ ...place(r, c), ...(human === null ? {} : seatStyle(human)) }}
                  data-playable={legal.has(index) ? "" : undefined}
                  data-active={
                    mode === "ultimate" && !state.over && activeBoards.has(board) ? "" : undefined
                  }
                  data-last={state.last === index ? "" : undefined}
                  data-line={mode === "classic" && line.has(index) ? "" : undefined}
                  onClick={() => {
                    play(index);
                  }}
                >
                  {v !== EMPTY && (
                    <span className="gut-mark" style={seatStyle(v)}>
                      <SeatShape seat={v} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {mode === "ultimate" &&
          boards.map((b, i) =>
            b === 0 || b === 1 ? (
              <span
                key={`won-${String(i)}`}
                className="gut-won"
                aria-hidden="true"
                data-line={line.has(i) ? "" : undefined}
                style={{
                  ...seatStyle(b),
                  gridColumn: `${String((i % 3) * 4 + 1)} / span 3`,
                  gridRow: `${String(Math.floor(i / 3) * 4 + 1)} / span 3`,
                }}
              >
                <SeatShape seat={b} />
              </span>
            ) : null,
          )}
      </div>
      <div className="gk-bar">
        {match?.mode === "solo-bots" && (
          <button
            type="button"
            className="gk-btn"
            disabled={!view?.canUndo}
            onClick={() => {
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
.gut { --gut-size: min(100%, 34rem, calc(100dvh - 15rem)); display: grid; justify-items: center; gap: 0.75rem; width: 100%; user-select: none; -webkit-user-select: none; }
.gut-seats { display: flex; gap: 1rem; margin: 0; padding: 0; list-style: none; }
.gut-seats li { display: flex; align-items: center; gap: 0.35rem; padding: 0.1rem 0.5rem; border-radius: 999px; }
.gut-seats li[data-turn] { box-shadow: 0 0 0 2px var(--fill); }
.gut-chip { display: grid; place-items: center; width: 1.3rem; height: 1.3rem; border-radius: 50%; background: var(--fill); }
.gut-chip svg { width: 60%; height: 60%; fill: var(--ink); }
.gut-board { direction: ltr; position: relative; display: grid; width: var(--gut-size); aspect-ratio: 1; padding: 2%; gap: 3px; border-radius: 0.75rem; background: var(--surface-2); box-sizing: border-box; touch-action: manipulation; }
.gut-board[data-mode="ultimate"] { grid-template-columns: repeat(3, 1fr) 0.5rem repeat(3, 1fr) 0.5rem repeat(3, 1fr); grid-template-rows: repeat(3, 1fr) 0.5rem repeat(3, 1fr) 0.5rem repeat(3, 1fr); }
.gut-board[data-mode="classic"] { grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); gap: 6px; }
.gut-row { display: contents; }
.gut-cell { position: relative; display: grid; place-items: center; border-radius: 0.35rem; background: var(--surface); box-shadow: inset 0 0 0 1px var(--border); }
.gut-cell[data-active] { background: color-mix(in srgb, var(--brand) 18%, var(--surface)); }
.gut-cell[data-playable] { cursor: pointer; }
.gut-cell[data-playable]:hover { box-shadow: inset 0 0 0 2px var(--fill); }
.gut-cell:focus-visible { outline: 3px solid var(--focus); outline-offset: 1px; z-index: 2; }
.gut-cell[data-last] { box-shadow: inset 0 0 0 2px var(--text); }
.gut-cell[data-line] { background: color-mix(in srgb, var(--fill) 35%, var(--surface)); }
.gut-mark { display: grid; place-items: center; width: 74%; aspect-ratio: 1; border-radius: 30%; background: var(--fill); }
.gut-mark svg { width: 60%; height: 60%; fill: var(--ink); }
.gut-won { display: grid; place-items: center; border-radius: 0.6rem; background: color-mix(in srgb, var(--fill) 78%, transparent); pointer-events: none; z-index: 1; }
.gut-won svg { width: 62%; height: 62%; fill: var(--ink); }
.gut-won[data-line] { box-shadow: 0 0 0 3px var(--text); }
`;
