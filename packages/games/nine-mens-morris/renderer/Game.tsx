// Nine Men's Morris board: tap an empty point to place a piece; once all
// are placed, tap a piece and then where it goes. When a move closes a mill,
// the other player's pieces that may be taken are marked: tap one. The board
// is drawn on a 7 × 7 grid and stays left to right in every language.
import { useState, useSyncExternalStore } from "react";

import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  SeatShape,
  seatStyle,
  useGridFocus,
  useTurnFeedback,
} from "@kefche/game-sdk/react";

import {
  COORDS,
  countOf,
  EMPTY,
  engine,
  movesFor,
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

const GRID = 7;
/** The point on each grid cell, or -1 between points. */
const POINT_AT = Array.from({ length: GRID * GRID }, (_, cell) =>
  COORDS.findIndex(([c, r]) => r * GRID + c === cell),
);
const LINES = ["M0 0H6V6H0Z", "M1 1H5V5H1Z", "M2 2H4V4H2Z", "M3 0V2M3 4V6M0 3H2M4 3H6"];
/** "a7": the usual coordinates, files a–g left to right, ranks 1–7 from the bottom. */
const coordinate = (point: number) => {
  const [c, r] = COORDS[point] ?? [0, 0];
  return `${"abcdefg"[c] ?? ""}${String(GRID - r)}`;
};

export function Game({ context, config, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const [initial] = useState(() => engine.initialState(config, 2, context.seed));
  const state = view?.state ?? initial;
  const { board } = state;
  // The move so far: the piece picked (moving), then where it goes (before a removal).
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);

  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";
  const human = view?.humanSeat ?? null;
  const legal = human === null ? [] : movesFor(state, human);
  const placing = human !== null && (state.inHand[human] ?? 0) > 0;
  const choosingRemoval = to !== null;
  const matching = legal.filter(
    (m) => (placing || m.from === from) && (to === null || m.to === to),
  );
  const movable = new Set(placing ? [] : legal.map((m) => m.from));
  const targets = new Set(
    to === null && (placing || from !== null) ? matching.map((m) => m.to) : [],
  );
  const removals = new Set(
    choosingRemoval ? matching.flatMap((m) => (m.remove === null ? [] : [m.remove])) : [],
  );

  useTurnFeedback({
    context,
    view,
    moves: state.moves,
    sounds,
    onMove: (current) => {
      setFrom(null);
      setTo(null);
      sounds.play(current.state.last?.remove != null ? "mill" : "move");
    },
  });

  const reset = () => {
    setFrom(null);
    setTo(null);
  };
  const tap = (point: number) => {
    if (human === null) return;
    if (choosingRemoval) {
      const move = matching.find((m) => m.remove === point);
      if (move) {
        reset();
        session.act(human, move);
      }
      return;
    }
    if (!placing && board[point] === human && movable.has(point)) {
      setFrom(from === point ? null : point);
      return;
    }
    if (!targets.has(point)) return;
    const options = matching.filter((m) => m.to === point);
    const [only] = options;
    if (options.length === 1 && only?.remove === null) {
      reset();
      session.act(human, only);
    } else setTo(point);
  };

  const grid = useGridFocus({
    cols: GRID,
    rows: GRID,
    initial: 0,
    isCell: (cell) => (POINT_AT[cell] ?? -1) >= 0,
    onActivate: (cell) => {
      const point = POINT_AT[cell] ?? -1;
      if (point >= 0) tap(point);
    },
  });

  const label = (point: number) => {
    const v = board[point] ?? EMPTY;
    const cell = coordinate(point);
    const parts = [
      v === EMPTY
        ? t("pointEmpty", { point: cell })
        : t("pointPiece", { point: cell, name: name(v) }),
    ];
    if (point === from) parts.push(t("selected"));
    else if (removals.has(point)) parts.push(t("canRemove"));
    else if (targets.has(point)) parts.push(t("target"));
    else if (from === null && movable.has(point)) parts.push(t("canMove"));
    return parts.join(", ");
  };

  const last = state.last;
  const lastSeat = 1 - state.turn;
  const announcement = last
    ? [
        last.from === null
          ? t("placed", { name: name(lastSeat), point: coordinate(last.to) })
          : t("moved", {
              name: name(lastSeat),
              from: coordinate(last.from),
              to: coordinate(last.to),
            }),
        last.remove === null
          ? ""
          : t("removed", { name: name(lastSeat), point: coordinate(last.remove) }),
      ].join(" ")
    : "";
  const prompt =
    human === null
      ? ""
      : choosingRemoval
        ? t("promptRemove", { name: name(1 - human) })
        : placing
          ? t("promptPlace")
          : t("promptMove");

  return (
    <div className="gnm" data-motion={context.settings.reducedMotion ? "off" : "on"}>
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <ul className="gnm-counts">
        {[0, 1].map((seat) => (
          <li key={seat} style={seatStyle(seat)}>
            <span className="gnm-chip" aria-hidden="true">
              <SeatShape seat={seat} />
            </span>
            <span className="gk-sr">{name(seat)}</span>
            <span>
              {t("onBoard")} <strong>{countOf(board, seat)}</strong>
            </span>
            {(state.inHand[seat] ?? 0) > 0 && (
              <span className="gnm-hand">
                {t("inHand")} <strong>{state.inHand[seat]}</strong>
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="gnm-board">
        <svg className="gnm-lines" viewBox="-0.5 -0.5 7 7" aria-hidden="true">
          {LINES.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
        <div className="gnm-grid" role="grid" aria-label={t("boardLabel")}>
          {Array.from({ length: GRID }, (_, r) => (
            <div key={r} role="row" className="gnm-row">
              {Array.from({ length: GRID }, (__, c) => {
                const cell = r * GRID + c;
                const point = POINT_AT[cell] ?? -1;
                if (point < 0) return <div key={cell} role="presentation" />;
                const v = board[point] ?? EMPTY;
                const focus = grid.cellProps(cell);
                return (
                  <div
                    key={cell}
                    ref={focus.ref}
                    tabIndex={focus.tabIndex}
                    onFocus={focus.onFocus}
                    onKeyDown={focus.onKeyDown}
                    role="gridcell"
                    aria-label={label(point)}
                    className="gnm-point"
                    data-target={targets.has(point) ? "" : undefined}
                    data-remove={removals.has(point) ? "" : undefined}
                    data-picked={point === from || point === to ? "" : undefined}
                    data-movable={
                      from === null && to === null && movable.has(point) ? "" : undefined
                    }
                    data-last={last && (last.to === point || last.from === point) ? "" : undefined}
                    style={human === null ? undefined : seatStyle(human)}
                    onClick={() => {
                      tap(point);
                    }}
                  >
                    {v !== EMPTY && (
                      <span className="gnm-piece" style={seatStyle(v)}>
                        <SeatShape seat={v} />
                      </span>
                    )}
                    {to === point && v === EMPTY && human !== null && (
                      <span className="gnm-piece" data-ghost="" style={seatStyle(human)}>
                        <SeatShape seat={human} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="gk-bar">
        {prompt !== "" && <p className="gnm-prompt">{prompt}</p>}
        {(from !== null || to !== null) && (
          <button type="button" className="gk-btn" onClick={reset}>
            {t("cancel")}
          </button>
        )}
        {match?.mode === "solo-bots" && (
          <button
            type="button"
            className="gk-btn"
            disabled={!view?.canUndo}
            onClick={() => {
              reset();
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

// Scoped by the gnm- prefix. The board is the game's own wood; pieces use the
// seat's --player-<n> colour and shape.
const CSS = `
.gnm { --gnm-size: min(100%, 32rem, calc(100dvh - 16rem)); display: grid; justify-items: center; gap: 0.75rem; width: 100%; user-select: none; -webkit-user-select: none; }
.gnm-counts { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.35rem 1.25rem; margin: 0; padding: 0; list-style: none; font-variant-numeric: tabular-nums; }
.gnm-counts li { display: flex; align-items: center; gap: 0.4rem; }
.gnm-hand { color: var(--muted); }
.gnm-chip { display: grid; place-items: center; width: 1.6rem; height: 1.6rem; border-radius: 50%; background: var(--fill); }
.gnm-chip svg { width: 60%; height: 60%; fill: var(--ink); }
.gnm-board { position: relative; direction: ltr; width: var(--gnm-size); aspect-ratio: 1; border-radius: 0.75rem; background: #e2c08d; box-shadow: inset 0 0 0 3px #a3763f; }
.gnm-lines { position: absolute; inset: 0; width: 100%; height: 100%; }
.gnm-lines path { fill: none; stroke: #5a3d1c; stroke-width: 0.06; }
.gnm-grid { position: absolute; inset: 0; display: grid; grid-template-rows: repeat(7, 1fr); }
.gnm-row { display: grid; grid-template-columns: repeat(7, 1fr); }
.gnm-point { position: relative; display: grid; place-items: center; cursor: default; }
.gnm-point::before { content: ""; position: absolute; width: 22%; aspect-ratio: 1; border-radius: 50%; background: #5a3d1c; }
.gnm-point[data-target], .gnm-point[data-remove], .gnm-point[data-movable], .gnm-point[data-picked] { cursor: pointer; }
.gnm-point[data-target]::before { width: 34%; background: #f3e2c4; box-shadow: inset 0 0 0 3px var(--fill), 0 0 0 1.5px #5a3d1c; }
.gnm-point:focus-visible { outline: 3px solid var(--focus); outline-offset: -3px; border-radius: 50%; z-index: 2; }
.gnm-piece { position: relative; z-index: 1; display: grid; place-items: center; width: 72%; aspect-ratio: 1; border-radius: 50%; background: var(--fill); box-shadow: 0 3px 0 rgb(0 0 0 / 0.35), inset 0 0 0 2px color-mix(in srgb, var(--ink) 30%, transparent); }
.gnm-piece svg { width: 48%; height: 48%; fill: var(--ink); opacity: 0.8; }
.gnm-piece[data-ghost] { opacity: 0.55; }
.gnm-point[data-movable] .gnm-piece { box-shadow: 0 3px 0 rgb(0 0 0 / 0.35), 0 0 0 3px #fff8; }
.gnm-point[data-picked] .gnm-piece { box-shadow: 0 0 0 4px #fff; }
.gnm-point[data-remove] .gnm-piece { box-shadow: 0 0 0 4px var(--danger); animation: none; }
.gnm-point[data-last] .gnm-piece { outline: 2px solid #fff; outline-offset: 2px; }
.gnm-prompt { margin: 0; font-weight: 600; }
`;
