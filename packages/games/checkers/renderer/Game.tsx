// Checkers board: tap a piece, then where it goes; a capture of several
// pieces is tapped one landing at a time, and plays as soon as it's complete.
// Pieces that can move are marked; captures are mandatory, so only capturing
// pieces can be picked when there's one. Seat 0 plays from the bottom; a
// person playing the other side sees the board turned round. The board stays
// left to right in every language.
import { useState, useSyncExternalStore } from "react";

import { yourSeat } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  SeatShape,
  seatStyle,
  useGridFocus,
  useTurnFeedback,
} from "@kefche/game-sdk/react";

import {
  countPieces,
  EMPTY,
  engine,
  isDark,
  isKing,
  movesFor,
  seatOf,
  type Action,
  type Config,
  type State,
} from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  config: Config;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

const FILES = "abcdefghij";

export function Game({ context, config, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const [initial] = useState(() => engine.initialState(config, 2, context.seed));
  const state = view?.state ?? initial;
  const { board, size } = state;
  // The squares picked so far: a piece, then each landing of a capture.
  const [picked, setPicked] = useState<number[]>([]);

  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";
  const human = view?.humanSeat ?? null;
  const legal = human === null ? [] : movesFor(state, human);
  const following = legal.filter((m) => picked.every((sq, i) => m.path[i] === sq));
  const movable = new Set(legal.map((m) => m.path[0]));
  const targets = new Set(
    picked.length === 0
      ? []
      : following.map((m) => m.path[picked.length]).filter((sq) => sq !== undefined),
  );
  const mustCapture = legal.some((m) => m.captures.length > 0);
  // The person on the other side looks at the board from their end.
  const flipped = yourSeat(match) === 1 || (match?.mode === "solo-bots" && human === 1);
  const cells = size * size;
  const squareAt = (index: number) => (flipped ? cells - 1 - index : index);
  const coordinate = (square: number) =>
    `${FILES[square % size] ?? ""}${String(size - Math.floor(square / size))}`;

  useTurnFeedback({
    context,
    view,
    moves: state.moves,
    sounds,
    onMove: (current) => {
      setPicked([]);
      const last = current.state.last;
      sounds.play(last && last.captures.length > 0 ? "capture" : "move");
    },
  });

  const pick = (square: number) => {
    if (human === null) return;
    const piece = board[square] ?? EMPTY;
    // A movable piece of your own starts (or restarts) the move.
    if (piece !== EMPTY && seatOf(piece) === human && movable.has(square)) {
      setPicked(picked[0] === square && picked.length === 1 ? [] : [square]);
      return;
    }
    if (!targets.has(square)) return;
    const path = [...picked, square];
    const done = following.find((m) => m.path.length === path.length && m.path.at(-1) === square);
    if (done) {
      setPicked([]);
      session.act(human, { path: done.path });
    } else setPicked(path);
  };

  const grid = useGridFocus({
    cols: size,
    rows: size,
    initial: squareAt(board.findIndex((v) => v !== EMPTY && seatOf(v) === (human ?? 0))),
    isCell: (index) => isDark(squareAt(index), size),
    onActivate: (index) => {
      pick(squareAt(index));
    },
  });

  const label = (square: number) => {
    const piece = board[square] ?? EMPTY;
    const cell = coordinate(square);
    const parts = [
      piece === EMPTY
        ? t("cellEmpty", { cell })
        : t(isKing(piece) ? "cellKing" : "cellMan", { cell, name: name(seatOf(piece)) }),
    ];
    if (picked.includes(square)) parts.push(t("selected"));
    else if (targets.has(square)) parts.push(t("target"));
    else if (picked.length === 0 && movable.has(square)) parts.push(t("canMove"));
    return parts.join(", ");
  };

  const last = state.last;
  const lastSeat = 1 - state.turn;
  const announcement = last
    ? [
        last.captures.length > 0
          ? t("captured", {
              name: name(lastSeat),
              from: coordinate(last.path[0] ?? 0),
              to: coordinate(last.path.at(-1) ?? 0),
              count: last.captures.length,
            })
          : t("moved", {
              name: name(lastSeat),
              from: coordinate(last.path[0] ?? 0),
              to: coordinate(last.path.at(-1) ?? 0),
            }),
      ].join(" ")
    : "";
  const lastSquares = new Set(last ? [last.path[0], last.path.at(-1)] : []);

  return (
    <div className="gck" data-motion={context.settings.reducedMotion ? "off" : "on"}>
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <ul className="gck-counts">
        {[0, 1].map((seat) => (
          <li key={seat} style={seatStyle(seat)}>
            <span className="gck-chip" aria-hidden="true">
              <SeatShape seat={seat} />
            </span>
            <span className="gk-sr">{name(seat)}</span>
            <strong>{countPieces(board, seat)}</strong>
          </li>
        ))}
      </ul>

      <div
        className="gck-board"
        role="grid"
        aria-label={t("boardLabel")}
        style={{ "--n": String(size) } as React.CSSProperties}
      >
        {Array.from({ length: size }, (_, r) => (
          <div key={r} role="row" className="gck-row">
            {Array.from({ length: size }, (__, c) => {
              const index = r * size + c;
              const square = squareAt(index);
              if (!isDark(square, size)) {
                return <div key={index} role="presentation" className="gck-light" />;
              }
              const piece = board[square] ?? EMPTY;
              const focus = grid.cellProps(index);
              return (
                <div
                  key={index}
                  ref={focus.ref}
                  tabIndex={focus.tabIndex}
                  onFocus={focus.onFocus}
                  onKeyDown={focus.onKeyDown}
                  role="gridcell"
                  aria-label={label(square)}
                  className="gck-cell"
                  data-movable={picked.length === 0 && movable.has(square) ? "" : undefined}
                  data-picked={picked.includes(square) ? "" : undefined}
                  data-target={targets.has(square) ? "" : undefined}
                  data-last={lastSquares.has(square) ? "" : undefined}
                  data-taken={last?.captures.includes(square) ? "" : undefined}
                  onClick={() => {
                    pick(square);
                  }}
                >
                  {piece !== EMPTY && (
                    <span className="gck-piece" style={seatStyle(seatOf(piece))}>
                      <SeatShape seat={seatOf(piece)} />
                      {isKing(piece) && (
                        <svg className="gck-crown" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M3 18h18l-1.5-10-4.5 4-3-7-3 7-4.5-4z" />
                        </svg>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="gk-bar">
        {human !== null && mustCapture && <p className="gck-note">{t("mustCapture")}</p>}
        {match?.mode === "solo-bots" && (
          <button
            type="button"
            className="gk-btn"
            disabled={!view?.canUndo}
            onClick={() => {
              setPicked([]);
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

// Scoped by the gck- prefix. The board is the game's own wood; pieces use the
// seat's --player-<n> colour and shape, and kings wear a crown.
const CSS = `
.gck { --gck-size: min(100%, 36rem, calc(100dvh - 15rem)); display: grid; justify-items: center; gap: 0.75rem; width: 100%; user-select: none; -webkit-user-select: none; }
.gck-counts { display: flex; gap: 1rem; margin: 0; padding: 0; list-style: none; }
.gck-counts li { display: flex; align-items: center; gap: 0.4rem; font-size: 1.25rem; font-variant-numeric: tabular-nums; }
.gck-chip { display: grid; place-items: center; width: 1.75rem; height: 1.75rem; border-radius: 50%; background: var(--fill); }
.gck-chip svg { width: 60%; height: 60%; fill: var(--ink); }
.gck-board { direction: ltr; display: grid; grid-template-rows: repeat(var(--n), minmax(0, 1fr)); width: var(--gck-size); aspect-ratio: 1; padding: 1.2%; border-radius: 0.6rem; background: #6b4426; box-sizing: border-box; touch-action: manipulation; }
.gck-row { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); }
.gck-light { background: #ecd3a8; }
.gck-cell { position: relative; display: grid; place-items: center; background: #a8703f; cursor: default; }
.gck-cell[data-movable], .gck-cell[data-target], .gck-cell[data-picked] { cursor: pointer; }
.gck-cell[data-last] { background: #8f5a2d; }
.gck-cell:focus-visible { outline: 3px solid #fff; outline-offset: -3px; z-index: 1; }
.gck-cell[data-movable]::before { content: ""; position: absolute; inset: 6%; border: 2px dashed #fff8; border-radius: 50%; }
.gck-cell[data-picked]::before { content: ""; position: absolute; inset: 3%; border: 3px solid #fff; border-radius: 50%; }
.gck-cell[data-target]::after { content: ""; width: 30%; aspect-ratio: 1; border-radius: 50%; background: #fff; opacity: 0.8; box-shadow: 0 0 0 2px #3b2414; }
.gck-cell[data-taken]::after { content: ""; position: absolute; width: 22%; aspect-ratio: 1; border-radius: 50%; border: 2px solid #fffa; }
.gck-piece { position: relative; display: grid; place-items: center; width: 78%; aspect-ratio: 1; border-radius: 50%; background: var(--fill); box-shadow: 0 3px 0 rgb(0 0 0 / 0.4), inset 0 0 0 3px color-mix(in srgb, var(--ink) 30%, transparent); }
.gck-piece > svg:first-child { width: 42%; height: 42%; fill: var(--ink); opacity: 0.75; }
.gck-crown { position: absolute; top: -12%; width: 55%; height: 55%; fill: #ffd84a; stroke: #3b2414; stroke-width: 1.6; stroke-linejoin: round; }
[data-motion="on"] .gck-cell[data-last] .gck-piece { animation: gck-land 220ms ease-out; }
@keyframes gck-land { from { transform: scale(1.12); } to { transform: scale(1); } }
.gck-note { margin: 0; font-weight: 600; }
`;
