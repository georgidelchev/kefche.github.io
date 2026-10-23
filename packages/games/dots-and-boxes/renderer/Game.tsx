// Dots and Boxes board: a grid of dots with a button for every line between
// two neighbours. Tap or click a line, or move between lines with the arrow
// keys and press Enter. Drawn lines take the colour of the player who drew
// them; closed boxes their owner's colour and shape. The board stays left to
// right in every language.
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { seatShape } from "@kefche/game-sdk";
import { HAPTICS, SHAPE_PATHS, vibrate } from "@kefche/game-sdk/browser";
import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";

import { engine, horizontalCount, score, type Action, type State } from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

const LETTERS = "abcdefghij";
const dotName = (r: number, c: number) => `${LETTERS[c] ?? ""}${String(r + 1)}`;
/** Dots share the board with lines at a quarter of a box's size. */
const DOT = 0.24;

const seatColours = (seat: number): CSSProperties => {
  const n = String((seat % 8) + 1);
  return { "--fill": `var(--player-${n})`, "--ink": `var(--player-${n}-ink)` } as CSSProperties;
};

/** A line's place in the (2 rows + 1) × (2 cols + 1) layout grid, and its two dots. */
function lineGeometry(s: Pick<State, "cols" | "rows">, line: number) {
  const h = horizontalCount(s);
  if (line < h) {
    const r = Math.floor(line / s.cols);
    const c = line % s.cols;
    return { gr: 2 * r, gc: 2 * c + 1, from: dotName(r, c), to: dotName(r, c + 1) };
  }
  const v = line - h;
  const r = Math.floor(v / (s.cols + 1));
  const c = v % (s.cols + 1);
  return { gr: 2 * r + 1, gc: 2 * c, from: dotName(r, c), to: dotName(r + 1, c) };
}

/** The line at a layout cell, or null for dots, boxes and the outside. */
function lineAt(s: Pick<State, "cols" | "rows">, gr: number, gc: number): number | null {
  if (gr < 0 || gc < 0 || gr > 2 * s.rows || gc > 2 * s.cols) return null;
  if (gr % 2 === 0 && gc % 2 === 1) return (gr / 2) * s.cols + (gc - 1) / 2;
  if (gr % 2 === 1 && gc % 2 === 0)
    return horizontalCount(s) + ((gr - 1) / 2) * (s.cols + 1) + gc / 2;
  return null;
}

export function Game({ context, store, session, sounds }: Props) {
  const { t, match } = context;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const [initial] = useState(() =>
    engine.initialState(undefined, match?.seats.length ?? 2, context.seed),
  );
  const state = view?.state ?? initial;
  const { cols, rows, lines, boxes } = state;
  const [focus, setFocus] = useState(0);
  const linesRef = useRef<(HTMLButtonElement | null)[]>([]);
  // Moves already sounded, so undo and re-renders stay quiet.
  const heardRef = useRef(0);

  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";
  const human = view?.humanSeat ?? null;
  const claimed = new Set(state.claimed);

  let announcement = "";
  if (state.last !== null) {
    const { from, to } = lineGeometry(state, state.last);
    const who = name(lines[state.last] ?? 0);
    announcement =
      state.claimed.length > 0
        ? t("closed", { name: who, from, to, count: state.claimed.length })
        : t("drew", { name: who, from, to });
  }

  useEffect(() => {
    if (!view) return;
    if (state.moves <= heardRef.current) {
      heardRef.current = state.moves;
      return;
    }
    heardRef.current = state.moves;
    const mover = state.last === null ? undefined : lines[state.last];
    if (mover !== undefined && match?.seats[mover]?.kind === "human") {
      vibrate(HAPTICS.tap, context.settings.haptics);
    }
    const result = view.result;
    if (!result) {
      sounds.play(state.claimed.length > 0 ? "box" : "line");
      return;
    }
    const outcome = result.outcome ?? [];
    const you = match?.mode === "solo-bots" ? match.seats.findIndex((s) => s.kind === "human") : -1;
    if (outcome.every((o) => o === outcome[0])) sounds.play("draw");
    else if (you >= 0 && outcome[you] !== Math.max(...outcome)) {
      sounds.play("lose");
      vibrate(HAPTICS.lose, context.settings.haptics);
    } else {
      sounds.play("win");
      vibrate(HAPTICS.win, context.settings.haptics);
    }
  }, [view, state, lines, match, sounds, context.settings.haptics]);

  const drawLine = (line: number) => {
    if (human === null) return;
    session.act(human, { line });
  };
  const moveFocus = (line: number) => {
    setFocus(line);
    linesRef.current[line]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent, line: number) => {
    const { gr, gc } = lineGeometry(state, line);
    // Left and right stay in the row; up and down step to the nearest line above or below.
    const step = (dr: number) => lineAt(state, gr + dr, gc - 1) ?? lineAt(state, gr + dr, gc + 1);
    const targets: Record<string, number | null> = {
      ArrowLeft: lineAt(state, gr, gc - 2),
      ArrowRight: lineAt(state, gr, gc + 2),
      ArrowUp: step(-1),
      ArrowDown: step(1),
    };
    if (e.key in targets) {
      const target = targets[e.key];
      if (target !== null && target !== undefined) moveFocus(target);
    } else if (e.key === "Enter" || e.key === " ") drawLine(line);
    else return;
    e.preventDefault();
  };

  const cells: ReactNode[] = [];
  for (let gr = 0; gr <= 2 * rows; gr++) {
    for (let gc = 0; gc <= 2 * cols; gc++) {
      const key = `${String(gr)}-${String(gc)}`;
      const place = { gridRow: gr + 1, gridColumn: gc + 1 };
      const line = lineAt(state, gr, gc);
      if (line !== null) {
        const owner = lines[line] ?? -1;
        const { from, to } = lineGeometry(state, line);
        const playable = human !== null && owner === -1;
        cells.push(
          <button
            key={key}
            ref={(el) => {
              linesRef.current[line] = el;
            }}
            type="button"
            className="gdb-line"
            data-dir={gr % 2 === 0 ? "h" : "v"}
            data-drawn={owner === -1 ? undefined : ""}
            data-last={line === state.last ? "" : undefined}
            data-playable={playable ? "" : undefined}
            tabIndex={line === focus ? 0 : -1}
            aria-disabled={!playable}
            aria-label={
              owner === -1
                ? t("line", { from, to })
                : t("lineDrawn", { from, to, name: name(owner) })
            }
            style={{
              ...place,
              ...(owner === -1 ? (human === null ? {} : seatColours(human)) : seatColours(owner)),
            }}
            onFocus={() => {
              setFocus(line);
            }}
            onClick={() => {
              drawLine(line);
            }}
            onKeyDown={(e) => {
              onKeyDown(e, line);
            }}
          >
            <span className="gdb-bar" />
          </button>,
        );
      } else if (gr % 2 === 0) {
        cells.push(<span key={key} className="gdb-dot" style={place} />);
      } else {
        const box = ((gr - 1) / 2) * cols + (gc - 1) / 2;
        const owner = boxes[box] ?? -1;
        cells.push(
          <span
            key={key}
            className="gdb-box"
            data-new={claimed.has(box) ? "" : undefined}
            style={{ ...place, ...(owner === -1 ? {} : seatColours(owner)) }}
          >
            {owner !== -1 && (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={SHAPE_PATHS[seatShape(owner)]} />
              </svg>
            )}
          </span>,
        );
      }
    }
  }

  const ratio = (cols + DOT * (cols + 1)) / (rows + DOT * (rows + 1));
  const motion = !context.settings.reducedMotion;
  return (
    <div
      className="gdb"
      data-motion={motion ? "on" : "off"}
      style={{ "--ratio": ratio } as CSSProperties}
    >
      <style>{CSS}</style>
      <ul className="gdb-scores">
        {Array.from({ length: state.seats }, (_, seat) => (
          <li key={seat} style={seatColours(seat)}>
            <span className="gdb-chip" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d={SHAPE_PATHS[seatShape(seat)]} />
              </svg>
            </span>
            <span className="gdb-hidden">
              {t("score", { name: name(seat), count: score(state, seat) })}
            </span>
            <strong aria-hidden="true">{score(state, seat)}</strong>
          </li>
        ))}
      </ul>
      <div
        className="gdb-board"
        role="group"
        aria-label={t("boardLabel")}
        style={{
          gridTemplateColumns: `repeat(${String(cols)}, ${String(DOT)}fr 1fr) ${String(DOT)}fr`,
          gridTemplateRows: `repeat(${String(rows)}, ${String(DOT)}fr 1fr) ${String(DOT)}fr`,
        }}
      >
        {cells}
      </div>
      {match?.mode === "solo-bots" && (
        <div className="gdb-bar-row">
          <button
            type="button"
            className="gdb-undo"
            disabled={!view?.canUndo}
            onClick={() => {
              session.undo();
            }}
          >
            {t("undo")}
          </button>
        </div>
      )}
      <p className="gdb-status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

// Scoped by the gdb- prefix. Surfaces use the site's tokens, so the board
// follows the light and dark themes; lines and boxes use --player-<n>.
const CSS = `
.gdb { --gdb-w: min(100%, 36rem, calc((100dvh - 16rem) * var(--ratio))); display: grid; justify-items: center; gap: 0.75rem; width: 100%; user-select: none; -webkit-user-select: none; }
.gdb-scores { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem 1rem; margin: 0; padding: 0; list-style: none; width: var(--gdb-w); }
.gdb-scores li { display: flex; align-items: center; gap: 0.4rem; font-size: 1.25rem; font-variant-numeric: tabular-nums; }
.gdb-chip { display: grid; place-items: center; width: 1.75rem; height: 1.75rem; border-radius: 0.45rem; background: var(--fill); }
.gdb-chip svg { width: 62%; height: 62%; fill: var(--ink); }
.gdb-board { direction: ltr; display: grid; width: var(--gdb-w); aspect-ratio: var(--ratio); padding: 3%; border-radius: 1rem; background: var(--surface); border: 2px solid var(--border); box-sizing: border-box; touch-action: manipulation; }
.gdb-dot { place-self: center; width: 100%; aspect-ratio: 1; border-radius: 50%; background: var(--text); transform: scale(0.75); z-index: 2; }
.gdb-line { position: relative; display: grid; place-items: center; min-width: 0; min-height: 0; padding: 0; margin: 0; border: 0; background: transparent; cursor: default; z-index: 1; }
/* A wider invisible target than the line itself, for fingers. */
.gdb-line::before { content: ""; position: absolute; inset: -0.6rem -0.1rem; }
.gdb-line[data-dir="v"]::before { inset: -0.1rem -0.6rem; }
.gdb-line[data-playable] { cursor: pointer; }
.gdb-bar { display: block; border-radius: 999px; background: color-mix(in srgb, var(--text) 14%, transparent); }
.gdb-line[data-dir="h"] .gdb-bar { width: 100%; height: 34%; }
.gdb-line[data-dir="v"] .gdb-bar { width: 34%; height: 100%; }
.gdb-line[data-playable]:hover .gdb-bar, .gdb-line[data-playable]:focus-visible .gdb-bar { background: color-mix(in srgb, var(--fill) 60%, transparent); }
.gdb-line[data-drawn] .gdb-bar { background: var(--fill); box-shadow: 0 0 0 1px color-mix(in srgb, var(--ink) 40%, transparent); }
.gdb-line[data-last] .gdb-bar { box-shadow: 0 0 0 2px var(--text); }
.gdb-line:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; border-radius: 0.3rem; }
.gdb-box { display: grid; place-items: center; margin: 6%; border-radius: 0.35rem; background: color-mix(in srgb, var(--fill, transparent) 45%, transparent); }
.gdb-box svg { width: 45%; height: 45%; fill: var(--ink); opacity: 0.75; }
[data-motion="on"] .gdb-box[data-new] { animation: gdb-pop 260ms ease-out; }
@keyframes gdb-pop { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.gdb-bar-row { display: flex; justify-content: center; width: var(--gdb-w); }
.gdb-undo { min-height: 2.75rem; padding-inline: 1.25rem; border-radius: 0.75rem; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-weight: 600; cursor: pointer; }
.gdb-undo:disabled { opacity: 0.45; cursor: not-allowed; }
.gdb-undo:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.gdb-status, .gdb-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;
