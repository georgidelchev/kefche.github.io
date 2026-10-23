// Four in a Row board: one button per column (tap or click it, or move with
// the arrow keys and press Enter, or press the column's number). Discs fall
// into place and carry their seat's shape as well as its colour. The board
// stays left to right in every language.
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

import { seatShape } from "@kefche/game-sdk";
import { HAPTICS, SHAPE_PATHS, vibrate, yourSeat } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";

import { engine, type Action, type State } from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  seed: string;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

const player = (seat: number) => (seat % 8) + 1;
const seatColours = (seat: number): CSSProperties =>
  ({
    "--fill": `var(--player-${String(player(seat))})`,
    "--ink": `var(--player-${String(player(seat))}-ink)`,
  }) as CSSProperties;

function Disc({ seat, fall, win }: { seat: number; fall?: number; win: boolean }) {
  return (
    <span
      className="gfr-disc"
      data-win={win ? "" : undefined}
      data-last={fall === undefined ? undefined : ""}
      style={{ ...seatColours(seat), ...(fall === undefined ? {} : { "--fall": fall }) }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={SHAPE_PATHS[seatShape(seat)]} />
      </svg>
    </span>
  );
}

export function Game({ context, seed, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const [initial] = useState(() => engine.initialState(undefined, match?.seats.length ?? 2, seed));
  const state = view?.state ?? initial;
  const { cols, rows, cells, heights } = state;
  const [focus, setFocus] = useState(() => Math.floor(cols / 2));
  const columnsRef = useRef<(HTMLButtonElement | null)[]>([]);
  // Moves already sounded, so undo and re-renders stay quiet.
  const heardRef = useRef(0);

  const human = view?.humanSeat ?? null;
  const last = view?.lastMove ?? null;
  const lastRow = last ? (heights[last.action.column] ?? 1) - 1 : -1;
  const lastCell = last ? last.action.column * rows + lastRow : -1;
  const winning = new Set(state.line);
  // Read out by screen readers whenever a disc lands.
  const announcement = last
    ? t("dropped", { name: match?.names[last.seat] ?? "", column: last.action.column + 1 })
    : "";

  useEffect(() => {
    if (!view) return;
    if (state.moves <= heardRef.current) {
      heardRef.current = state.moves;
      return;
    }
    heardRef.current = state.moves;
    const mover = view.lastMove?.seat;
    if (mover !== undefined && match?.seats[mover]?.kind === "human") {
      vibrate(HAPTICS.tap, context.settings.haptics);
    }
    const result = view.result;
    if (!result) {
      sounds.play("drop");
      return;
    }
    const outcome = result.outcome ?? [];
    const you = yourSeat(match);
    if (outcome.every((o) => o === 0.5)) sounds.play("draw");
    else if (you >= 0 && outcome[you] !== 1) {
      sounds.play("lose");
      vibrate(HAPTICS.lose, context.settings.haptics);
    } else {
      sounds.play("win");
      vibrate(HAPTICS.win, context.settings.haptics);
    }
  }, [view, state.moves, match, sounds, context.settings.haptics]);

  const drop = (column: number) => {
    if (human === null) return;
    session.act(human, { column });
  };
  const moveFocus = (column: number) => {
    const next = Math.max(0, Math.min(cols - 1, column));
    setFocus(next);
    columnsRef.current[next]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") moveFocus(focus - 1);
    else if (e.key === "ArrowRight") moveFocus(focus + 1);
    else if (e.key === "Home") moveFocus(0);
    else if (e.key === "End") moveFocus(cols - 1);
    else if (/^[0-9]$/.test(e.key)) {
      // 1–9 are the first nine columns, 0 the tenth.
      const column = e.key === "0" ? 9 : Number(e.key) - 1;
      if (column >= cols) return;
      moveFocus(column);
      drop(column);
    } else return;
    e.preventDefault();
  };

  const motion = !context.settings.reducedMotion;
  return (
    <div
      className="gfr"
      data-motion={motion ? "on" : "off"}
      style={{ "--cols": cols, "--rows": rows } as CSSProperties}
    >
      <style>{CSS}</style>
      <div
        className="gfr-board"
        role="toolbar"
        aria-label={t("boardLabel")}
        onKeyDown={onKeyDown}
        style={human === null ? undefined : seatColours(human)}
      >
        {Array.from({ length: cols }, (_, c) => {
          const height = heights[c] ?? 0;
          const free = rows - height;
          const playable = human !== null && free > 0;
          return (
            <button
              key={c}
              ref={(el) => {
                columnsRef.current[c] = el;
              }}
              type="button"
              className="gfr-col"
              tabIndex={c === focus ? 0 : -1}
              aria-label={
                free > 0
                  ? t("columnLabel", { column: c + 1, free })
                  : t("columnFull", { column: c + 1 })
              }
              aria-disabled={!playable}
              data-playable={playable ? "" : undefined}
              onFocus={() => {
                setFocus(c);
              }}
              onClick={() => {
                drop(c);
              }}
            >
              {Array.from({ length: rows }, (_, r) => {
                const cell = c * rows + r;
                const seat = cells[cell] ?? -1;
                return (
                  <span key={r} className="gfr-cell" data-next={r === height ? "" : undefined}>
                    {seat === -1 ? (
                      <span className="gfr-ghost" />
                    ) : (
                      <Disc
                        seat={seat}
                        win={winning.has(cell)}
                        {...(cell === lastCell ? { fall: rows - r } : {})}
                      />
                    )}
                  </span>
                );
              })}
            </button>
          );
        })}
      </div>
      {match?.mode === "solo-bots" && (
        <div className="gfr-bar">
          <button
            type="button"
            className="gfr-undo"
            disabled={!view?.canUndo}
            onClick={() => {
              session.undo();
            }}
          >
            {t("undo")}
          </button>
        </div>
      )}
      <p className="gfr-status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

// Scoped by the gfr- prefix. Colours come from the site's tokens, so the board
// follows the light and dark themes; discs use the seat's --player-<n> colour.
const CSS = `
.gfr { --gfr-w: min(100%, 44rem, calc((100dvh - 15rem) * var(--cols) / var(--rows))); display: grid; justify-items: center; gap: 0.75rem; width: 100%; user-select: none; -webkit-user-select: none; }
.gfr-board { direction: ltr; display: grid; grid-template-columns: repeat(var(--cols), 1fr); width: var(--gfr-w); aspect-ratio: var(--cols) / var(--rows); padding: 1.5%; gap: 0; border-radius: 1rem; background: var(--surface-2); border: 3px solid var(--border-strong); box-sizing: border-box; touch-action: manipulation; }
.gfr-col { display: flex; flex-direction: column-reverse; min-width: 0; padding: 0; margin: 0; border: 0; border-radius: 0.6rem; background: transparent; cursor: default; }
.gfr-col[data-playable] { cursor: pointer; }
.gfr-col[data-playable]:hover { background: color-mix(in srgb, var(--text) 6%, transparent); }
.gfr-col:focus-visible { outline: 3px solid var(--focus); outline-offset: -2px; }
.gfr-cell { position: relative; flex: 1; display: grid; place-items: center; min-height: 0; }
.gfr-cell::before { content: ""; position: absolute; width: 82%; aspect-ratio: 1; border-radius: 50%; background: var(--bg); box-shadow: inset 0 2px 3px color-mix(in srgb, var(--text) 18%, transparent); }
.gfr-ghost, .gfr-disc { position: relative; width: 82%; aspect-ratio: 1; border-radius: 50%; }
.gfr-ghost { opacity: 0; background: var(--fill); }
.gfr-col[data-playable]:hover .gfr-cell[data-next] .gfr-ghost, .gfr-col[data-playable]:focus-visible .gfr-cell[data-next] .gfr-ghost { opacity: 0.35; }
.gfr-disc { display: grid; place-items: center; background: var(--fill); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--ink) 35%, transparent); }
.gfr-disc svg { width: 55%; height: 55%; fill: var(--ink); opacity: 0.8; }
.gfr-disc[data-win] { box-shadow: 0 0 0 3px var(--text), inset 0 0 0 2px color-mix(in srgb, var(--ink) 35%, transparent); }
[data-motion="on"] .gfr-disc[data-last] { animation: gfr-drop calc(120ms + var(--fall) * 40ms) cubic-bezier(0.55, 0, 1, 0.45) both; }
[data-motion="on"] .gfr-disc[data-win] { animation: gfr-pulse 900ms ease-in-out 3; }
@keyframes gfr-drop { from { transform: translateY(calc(var(--fall) * -122%)); } to { transform: translateY(0); } }
@keyframes gfr-pulse { 50% { transform: scale(0.88); } }
.gfr-bar { display: flex; justify-content: center; width: var(--gfr-w); }
.gfr-undo { min-height: 2.75rem; padding-inline: 1.25rem; border-radius: 0.75rem; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-weight: 600; cursor: pointer; }
.gfr-undo:disabled { opacity: 0.45; cursor: not-allowed; }
.gfr-undo:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.gfr-status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
`;
