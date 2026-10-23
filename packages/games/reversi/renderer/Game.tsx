// Reversi board: an 8 × 8 grid. Tap or click a square, or move with the
// arrow keys and press Enter. Discs show their seat's shape as well as its
// colour, flip when captured, and dots mark the legal moves when hints are on.
// The board stays left to right in every language.
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

import { seatShape } from "@kefche/game-sdk";
import { HAPTICS, SHAPE_PATHS, vibrate } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";

import { countDiscs, engine, movesFor, SIZE, type Action, type State } from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

const HINTS_KEY = "hints";
const FILES = "abcdefgh";
/** "d3": file letter and rank number, ranks counted from the top. */
const coordinate = (square: number) =>
  `${FILES[square % SIZE] ?? ""}${String(Math.floor(square / SIZE) + 1)}`;

const seatColours = (seat: number): CSSProperties => {
  const n = String((seat % 8) + 1);
  return { "--fill": `var(--player-${n})`, "--ink": `var(--player-${n}-ink)` } as CSSProperties;
};

function Disc({ seat, flip }: { seat: number; flip: boolean }) {
  return (
    <span className="grv-disc" data-flip={flip ? "" : undefined} style={seatColours(seat)}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={SHAPE_PATHS[seatShape(seat)]} />
      </svg>
    </span>
  );
}

export function Game({ context, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const [initial] = useState(() => engine.initialState(undefined, 2, context.seed));
  const state = view?.state ?? initial;
  const { board } = state;
  const [focus, setFocus] = useState(19);
  const [hints, setHints] = useState(() => context.storage.get(HINTS_KEY) !== "0");
  const cellsRef = useRef<(HTMLDivElement | null)[]>([]);
  // Moves already sounded, so undo and re-renders stay quiet.
  const heardRef = useRef(0);

  const names = match?.names ?? [];
  const human = view?.humanSeat ?? null;
  const legal = new Set(human === null ? [] : movesFor(board, human));
  const flipped = new Set(state.flipped);
  const name = (seat: number) => names[seat] ?? "";
  const announcement =
    state.last === null
      ? ""
      : [
          t("played", {
            name: name(board[state.last] ?? 0),
            cell: coordinate(state.last),
            count: state.flipped.length,
          }),
          state.passed === null ? "" : t("passed", { name: name(state.passed) }),
        ].join(" ");

  useEffect(() => {
    if (!view) return;
    if (state.moves <= heardRef.current) {
      heardRef.current = state.moves;
      return;
    }
    heardRef.current = state.moves;
    const mover = state.last === null ? undefined : board[state.last];
    if (mover !== undefined && match?.seats[mover]?.kind === "human") {
      vibrate(HAPTICS.tap, context.settings.haptics);
    }
    const result = view.result;
    if (!result) {
      sounds.play(state.passed === null ? "place" : "pass");
      return;
    }
    const outcome = result.outcome ?? [];
    const you = match?.mode === "solo-bots" ? match.seats.findIndex((s) => s.kind === "human") : -1;
    if (outcome.every((o) => o === 0.5)) sounds.play("draw");
    else if (you >= 0 && outcome[you] !== 1) {
      sounds.play("lose");
      vibrate(HAPTICS.lose, context.settings.haptics);
    } else {
      sounds.play("win");
      vibrate(HAPTICS.win, context.settings.haptics);
    }
  }, [view, state, board, match, sounds, context.settings.haptics]);

  const place = (square: number) => {
    if (human === null) return;
    session.act(human, { square });
  };
  const moveFocus = (square: number) => {
    setFocus(square);
    cellsRef.current[square]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent, square: number) => {
    const row = Math.floor(square / SIZE);
    const col = square % SIZE;
    const to: Record<string, number> = {
      ArrowLeft: row * SIZE + Math.max(0, col - 1),
      ArrowRight: row * SIZE + Math.min(SIZE - 1, col + 1),
      ArrowUp: Math.max(0, row - 1) * SIZE + col,
      ArrowDown: Math.min(SIZE - 1, row + 1) * SIZE + col,
      Home: row * SIZE,
      End: row * SIZE + SIZE - 1,
    };
    const target = to[e.key];
    if (target !== undefined) moveFocus(target);
    else if (e.key === "Enter" || e.key === " ") place(square);
    else return;
    e.preventDefault();
  };

  const label = (square: number) => {
    const v = board[square] ?? -1;
    const cell = coordinate(square);
    if (v !== -1) return t("cellDisc", { cell, name: name(v) });
    return legal.has(square) ? t("cellMove", { cell }) : t("cellEmpty", { cell });
  };

  const motion = !context.settings.reducedMotion;
  return (
    <div className="grv" data-motion={motion ? "on" : "off"}>
      <style>{CSS}</style>
      <div className="grv-top">
        <ul className="grv-counts">
          {[0, 1].map((seat) => (
            <li key={seat} style={seatColours(seat)}>
              <span className="grv-chip" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d={SHAPE_PATHS[seatShape(seat)]} />
                </svg>
              </span>
              <span className="grv-hidden">{name(seat)}</span>
              <strong>{countDiscs(board, seat)}</strong>
            </li>
          ))}
        </ul>
        <label className="grv-hints">
          <input
            type="checkbox"
            checked={hints}
            onChange={(e) => {
              setHints(e.target.checked);
              context.storage.set(HINTS_KEY, e.target.checked ? "1" : "0");
            }}
          />
          {t("hints")}
        </label>
      </div>

      <div className="grv-board" role="grid" aria-label={t("boardLabel")}>
        {Array.from({ length: SIZE }, (_, r) => (
          <div key={r} role="row" className="grv-row">
            {Array.from({ length: SIZE }, (__, c) => {
              const square = r * SIZE + c;
              const v = board[square] ?? -1;
              const playable = legal.has(square);
              return (
                <div
                  key={square}
                  ref={(el) => {
                    cellsRef.current[square] = el;
                  }}
                  role="gridcell"
                  tabIndex={square === focus ? 0 : -1}
                  aria-label={label(square)}
                  aria-disabled={!playable}
                  className="grv-cell"
                  data-playable={playable ? "" : undefined}
                  data-hint={playable && hints ? "" : undefined}
                  data-last={square === state.last ? "" : undefined}
                  style={human === null ? undefined : seatColours(human)}
                  onFocus={() => {
                    setFocus(square);
                  }}
                  onClick={() => {
                    place(square);
                  }}
                  onKeyDown={(e) => {
                    onKeyDown(e, square);
                  }}
                >
                  {v !== -1 && <Disc seat={v} flip={flipped.has(square)} />}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="grv-bar">
        {state.passed !== null && !state.over && (
          <p className="grv-pass">{t("passed", { name: name(state.passed) })}</p>
        )}
        {match?.mode === "solo-bots" && (
          <button
            type="button"
            className="grv-undo"
            disabled={!view?.canUndo}
            onClick={() => {
              session.undo();
            }}
          >
            {t("undo")}
          </button>
        )}
      </div>
      <p className="grv-status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

// Scoped by the grv- prefix. The board is the game's own green; text and
// controls use the site's tokens, and discs the seat's --player-<n> colour.
const CSS = `
.grv { --grv-size: min(100%, 34rem, calc(100dvh - 16rem)); display: grid; justify-items: center; gap: 0.75rem; width: 100%; user-select: none; -webkit-user-select: none; }
.grv-top, .grv-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem 1rem; width: var(--grv-size); }
.grv-bar { justify-content: center; min-height: 2.75rem; }
.grv-counts { display: flex; gap: 0.75rem; margin: 0; padding: 0; list-style: none; }
.grv-counts li { display: flex; align-items: center; gap: 0.4rem; font-size: 1.25rem; font-variant-numeric: tabular-nums; }
.grv-chip { display: grid; place-items: center; width: 1.75rem; height: 1.75rem; border-radius: 50%; background: var(--fill); }
.grv-chip svg { width: 60%; height: 60%; fill: var(--ink); }
.grv-hints { display: flex; align-items: center; gap: 0.5rem; min-height: 2.75rem; font-weight: 600; cursor: pointer; }
.grv-hints input { width: 1.25rem; height: 1.25rem; accent-color: var(--brand); }
.grv-board { direction: ltr; display: grid; grid-template-rows: repeat(8, 1fr); width: var(--grv-size); aspect-ratio: 1; padding: 1.5%; border-radius: 0.75rem; background: #2f7d4f; border: 3px solid #1d4f32; box-sizing: border-box; touch-action: manipulation; }
.grv-row { display: grid; grid-template-columns: repeat(8, 1fr); }
.grv-cell { position: relative; display: grid; place-items: center; border: 1px solid #1d4f32; cursor: default; }
.grv-cell[data-playable] { cursor: pointer; }
.grv-cell:focus-visible { outline: 3px solid #fff; outline-offset: -3px; z-index: 1; }
.grv-cell[data-hint]::after { content: ""; width: 26%; aspect-ratio: 1; border-radius: 50%; background: var(--fill); opacity: 0.75; box-shadow: 0 0 0 2px #1d4f32; }
.grv-cell[data-playable]:hover::after { width: 70%; opacity: 0.45; }
.grv-cell[data-last]::before { content: ""; position: absolute; inset: 4%; border: 2px solid #fff; border-radius: 0.35rem; opacity: 0.7; }
.grv-disc { display: grid; place-items: center; width: 80%; aspect-ratio: 1; border-radius: 50%; background: var(--fill); box-shadow: 0 2px 0 rgb(0 0 0 / 0.35), inset 0 0 0 2px color-mix(in srgb, var(--ink) 35%, transparent); }
.grv-disc svg { width: 52%; height: 52%; fill: var(--ink); opacity: 0.8; }
[data-motion="on"] .grv-disc[data-flip] { animation: grv-flip 320ms ease-in-out; }
@keyframes grv-flip { 0% { transform: scaleX(1); } 50% { transform: scaleX(0.05); } 100% { transform: scaleX(1); } }
.grv-pass { margin: 0; font-weight: 600; }
.grv-undo { min-height: 2.75rem; padding-inline: 1.25rem; border-radius: 0.75rem; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-weight: 600; cursor: pointer; }
.grv-undo:disabled { opacity: 0.45; cursor: not-allowed; }
.grv-undo:focus-visible, .grv-hints input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.grv-status, .grv-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;
