// The board of a line game (Gomoku, Five Colors): a grid of points to place
// stones on. Dense boards are small on a phone, so with a touch screen the
// first tap shows where the stone would go and a second tap on the same
// point places it; a mouse click or Enter places at once. The winning line
// is drawn through. Gomoku's stones are black and white; Five Colors' wear
// each seat's colour and shape. The board stays left to right in every
// language.
import { useState, useSyncExternalStore, type CSSProperties } from "react";

import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  SeatShape,
  seatStyle,
  useGridFocus,
  useTurnFeedback,
} from "@kefche/game-sdk/react";

import { EMPTY, type Action, type State } from "../engine/lines";

export interface LineSounds {
  play(name: "stone" | "win" | "lose" | "draw"): void;
}

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: LineSounds;
  initial: State;
  /** Black and white stones (Gomoku), or each seat's colour (Five Colors). */
  look: "stones" | "seats";
}

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const coarse = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

export function LineGame({ context, store, session, sounds, initial, look }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const state = view?.state ?? initial;
  const { board, size } = state;
  const [aim, setAim] = useState<number | null>(null);
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";
  const human = view?.humanSeat ?? null;
  const winLine = new Set(state.winLine);
  const point = (p: number) => `${LETTERS[p % size] ?? ""}${String(size - Math.floor(p / size))}`;

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

  const place = (p: number) => {
    if (human === null || board[p] !== EMPTY) return;
    setAim(null);
    session.act(human, { point: p });
  };
  const tap = (p: number) => {
    if (human === null || board[p] !== EMPTY) return;
    if (coarse() && aim !== p) setAim(p);
    else place(p);
  };
  const grid = useGridFocus({
    cols: size,
    rows: size,
    initial: Math.floor((size * size) / 2),
    onActivate: place,
  });

  const stoneName = (seat: number) =>
    look === "stones" ? t(seat === 0 ? "black" : "white") : name(seat);
  const label = (p: number) => {
    const v = board[p] ?? EMPTY;
    const where = point(p);
    const base =
      v === EMPTY
        ? t("pointEmpty", { point: where })
        : t("pointStone", { point: where, name: stoneName(v) });
    return winLine.has(p) ? `${base}, ${t("inLine")}` : base;
  };
  const stoneProps = (seat: number) =>
    look === "stones"
      ? { "data-colour": String(seat) }
      : { style: seatStyle(seat), "data-seat": "" };
  const announcement = (() => {
    if (state.last === null) return "";
    const who = board[state.last] ?? 0;
    const placed = t("placed", { name: name(who), point: point(state.last) });
    return state.winner !== null
      ? `${placed} ${t("fiveInRow", { name: name(state.winner) })}`
      : placed;
  })();

  return (
    <div className="gln" data-motion={context.settings.reducedMotion ? "off" : "on"}>
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <ul className="gln-seats">
        {Array.from({ length: state.seats }, (_, seat) => (
          <li key={seat} data-turn={!state.over && state.turn === seat ? "" : undefined}>
            <span className="gln-stone gln-chip" {...stoneProps(seat)} aria-hidden="true">
              {look === "seats" && <SeatShape seat={seat} />}
            </span>
            <span>{look === "stones" ? t(seat === 0 ? "black" : "white") : name(seat)}</span>
          </li>
        ))}
        <li className="gln-goal">{t("goal", { count: state.line })}</li>
      </ul>
      <div
        className="gln-board"
        role="grid"
        aria-label={t("boardLabel")}
        style={{ "--n": String(size) } as CSSProperties}
      >
        {Array.from({ length: size }, (_, r) => (
          <div key={r} role="row" className="gln-row">
            {Array.from({ length: size }, (__, c) => {
              const p = r * size + c;
              const v = board[p] ?? EMPTY;
              const focus = grid.cellProps(p);
              return (
                <div
                  key={p}
                  ref={focus.ref}
                  tabIndex={focus.tabIndex}
                  onFocus={focus.onFocus}
                  onKeyDown={focus.onKeyDown}
                  role="gridcell"
                  aria-label={label(p)}
                  className="gln-point"
                  data-top={r === 0 ? "" : undefined}
                  data-bottom={r === size - 1 ? "" : undefined}
                  data-left={c === 0 ? "" : undefined}
                  data-right={c === size - 1 ? "" : undefined}
                  data-playable={human !== null && v === EMPTY ? "" : undefined}
                  onClick={() => {
                    tap(p);
                  }}
                >
                  {v !== EMPTY && (
                    <span
                      className="gln-stone"
                      {...stoneProps(v)}
                      data-last={state.last === p ? "" : undefined}
                      data-win={winLine.has(p) ? "" : undefined}
                    >
                      {look === "seats" && <SeatShape seat={v} />}
                    </span>
                  )}
                  {v === EMPTY && aim === p && human !== null && (
                    <span className="gln-stone" data-aim="" {...stoneProps(human)}>
                      {look === "seats" && <SeatShape seat={human} />}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="gk-bar">
        {aim !== null && <p className="gln-hint">{t("tapAgain")}</p>}
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
.gln { --gln-size: min(100%, 38rem, calc(100dvh - 15rem)); display: grid; justify-items: center; gap: 0.6rem; width: 100%; user-select: none; -webkit-user-select: none; }
.gln-seats { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 0.35rem 1rem; margin: 0; padding: 0; list-style: none; }
.gln-seats li { display: flex; align-items: center; gap: 0.35rem; padding: 0.1rem 0.45rem; border-radius: 999px; }
.gln-seats li[data-turn] { box-shadow: 0 0 0 2px var(--border-strong); }
.gln-goal { color: var(--muted); font-size: 0.875rem; }
.gln-stone.gln-chip { flex: none; width: 1.15rem; }
.gln-board { direction: ltr; display: grid; grid-template-rows: repeat(var(--n), minmax(0, 1fr)); width: var(--gln-size); aspect-ratio: 1; padding: 1.2%; border-radius: 0.5rem; background: #dcb36b; box-shadow: inset 0 0 0 2px #a0783a; box-sizing: border-box; touch-action: manipulation; }
.gln-row { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); }
.gln-point { position: relative; display: grid; place-items: center; }
.gln-point::before, .gln-point::after { content: ""; position: absolute; background: #5a4220; pointer-events: none; }
.gln-point::before { left: 0; right: 0; top: calc(50% - 0.5px); height: 1px; }
.gln-point::after { top: 0; bottom: 0; left: calc(50% - 0.5px); width: 1px; }
.gln-point[data-left]::before { left: 50%; }
.gln-point[data-right]::before { right: 50%; }
.gln-point[data-top]::after { top: 50%; }
.gln-point[data-bottom]::after { bottom: 50%; }
.gln-point[data-playable] { cursor: pointer; }
.gln-point:focus-visible { outline: 3px solid var(--focus); outline-offset: -2px; z-index: 2; border-radius: 3px; }
.gln-stone { position: relative; z-index: 1; display: grid; place-items: center; width: 88%; aspect-ratio: 1; border-radius: 50%; }
.gln-stone[data-colour="0"] { background: radial-gradient(circle at 35% 30%, #5a5a5a, #101010 60%); box-shadow: 0 1px 2px rgb(0 0 0 / 0.45); }
.gln-stone[data-colour="1"] { background: radial-gradient(circle at 35% 30%, #ffffff, #d7d7d2 70%); box-shadow: 0 1px 2px rgb(0 0 0 / 0.35), inset 0 0 0 1px #9a9a92; }
.gln-stone[data-seat] { background: var(--fill); box-shadow: 0 1px 2px rgb(0 0 0 / 0.4); }
.gln-stone[data-seat] svg { width: 55%; height: 55%; fill: var(--ink); opacity: 0.85; }
.gln-stone[data-aim] { opacity: 0.5; }
.gln-stone[data-last]::after { content: ""; position: absolute; inset: 34%; border-radius: 50%; border: 2px solid #e69f00; }
.gln-stone[data-colour="1"][data-last]::after { border-color: #c0392b; }
.gln-stone[data-seat][data-last]::after { inset: 18%; border: 2px solid #fff; box-shadow: 0 0 0 1px rgb(0 0 0 / 0.45); }
.gln-stone[data-win] { box-shadow: 0 0 0 3px #c0392b; }
.gln-hint { margin: 0; font-weight: 600; }
[data-motion="on"] .gln-stone[data-last] { animation: gln-place 160ms ease-out; }
@keyframes gln-place { from { transform: scale(1.18); } to { transform: scale(1); } }
`;
