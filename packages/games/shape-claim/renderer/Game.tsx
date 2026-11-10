// Shape Claim board: the grid, and the shared row of four pieces under it.
// Pick a piece from the row, turn or flip it (buttons, or R and F), then
// point at the board: the piece follows as a preview, in your colour where
// it fits and outlined in red where it doesn't. Click or press Enter to
// place it; with a touch screen, tap once to preview and again to place.
// When nothing in the row fits, Pass. The board stays left to right in
// every language.
import {
  useEffect,
  useEffectEvent,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";

import type { GameContext, TurnSession, TurnViewStore } from "@kefche/game-sdk/browser";
import {
  KIT_CSS,
  SeatShape,
  seatStyle,
  useGridFocus,
  useTurnFeedback,
} from "@kefche/game-sdk/react";

import {
  canPlace,
  cornerOf,
  EMPTY,
  engine,
  fits,
  scoreOf,
  SHAPES,
  type Action,
  type State,
} from "../engine";

import type { Sounds } from "./sounds";

interface Props {
  context: GameContext;
  store: TurnViewStore<State, Action>;
  session: TurnSession<Action>;
  sounds: Sounds;
}

type Cells = [number, number][];
const normalize = (cells: Cells): Cells => {
  const minR = Math.min(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  return cells.map(([r, c]) => [r - minR, c - minC] as [number, number]);
};
const rotate = (cells: Cells): Cells => normalize(cells.map(([r, c]) => [c, -r]));
const flip = (cells: Cells): Cells => normalize(cells.map(([r, c]) => [r, -c]));
/** A shape turned `turns` quarter turns, then flipped. */
const lay = (cells: Cells, turns: number, flipped: boolean): Cells => {
  let out = normalize(cells);
  for (let i = 0; i < turns; i++) out = rotate(out);
  return flipped ? flip(out) : out;
};
const shapeCells = (shape: number): Cells => (SHAPES[shape] ?? []).map(([r, c]) => [r, c]);
const coarse = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

function Mini({ cells }: { cells: Cells }) {
  const h = Math.max(...cells.map(([r]) => r)) + 1;
  const w = Math.max(...cells.map(([, c]) => c)) + 1;
  return (
    <svg
      viewBox={`0 0 ${String(Math.max(w, h))} ${String(Math.max(w, h))}`}
      aria-hidden="true"
      className="gsc-mini"
    >
      {cells.map(([r, c]) => (
        <rect
          key={`${String(r)}-${String(c)}`}
          x={c + 0.06}
          y={r + 0.06}
          width={0.88}
          height={0.88}
          rx={0.15}
        />
      ))}
    </svg>
  );
}

export function Game({ context, store, session, sounds }: Props) {
  const { t, match } = context;
  const seats = match?.seats.length ?? 2;
  const view = useSyncExternalStore(store.subscribe, store.get);
  const [initial] = useState(() => engine.initialState(undefined, seats, context.seed));
  const state = view?.state ?? initial;
  const { board, size, row } = state;
  const [chosen, setChosen] = useState(0);
  // How the chosen piece lies: quarter turns, then a flip.
  const [turns, setTurns] = useState(0);
  const [flipped, setFlipped] = useState(false);
  // The row shrinks at the end: fall back to its first piece.
  const slot = row[chosen] === undefined ? 0 : chosen;
  const cells = lay(shapeCells(row[slot] ?? 0), turns, flipped);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [aimed, setAimed] = useState<number | null>(null);
  const names = match?.names ?? [];
  const name = (seat: number) => names[seat] ?? "";
  const human = view?.humanSeat ?? null;
  const mustPass = human !== null && !canPlace(state, human);

  const choose = (index: number) => {
    if (row[index] === undefined) return;
    setChosen(index);
    setTurns(0);
    setFlipped(false);
  };
  const turn = () => {
    setTurns((n) => (n + 1) % 4);
  };
  const flipOver = () => {
    setFlipped((f) => !f);
  };

  useTurnFeedback({
    context,
    view,
    moves: state.moves,
    sounds,
    onMove: (current) => {
      setAimed(null);
      sounds.play(current.state.last ? "place" : "pass");
    },
  });

  const placement = (at: number | null): number[] | null => {
    if (at === null) return null;
    const r = Math.floor(at / size);
    const c = at % size;
    const out: number[] = [];
    for (const [dr, dc] of cells) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= size || cc >= size) return null;
      out.push(rr * size + cc);
    }
    return out;
  };
  const preview = placement(anchor);
  const fitsHere = human !== null && preview !== null && fits(state, human, preview);
  const place = (at: number) => {
    const target = placement(at);
    if (human === null || !target || !fits(state, human, target)) return;
    setAimed(null);
    session.act(human, { type: "place", slot, cells: target });
  };
  const tap = (at: number) => {
    setAnchor(at);
    if (coarse() && aimed !== at) setAimed(at);
    else place(at);
  };
  const grid = useGridFocus({
    cols: size,
    rows: size,
    initial: cornerOf(size, seats, human ?? 0),
    onActivate: place,
  });

  // R turns the piece, F flips it, 1–4 pick from the row.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (human === null || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "r" || e.key === "R") turn();
    else if (e.key === "f" || e.key === "F") flipOver();
    else if (/^[1-4]$/.test(e.key)) choose(Number(e.key) - 1);
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      onKey(e);
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
    };
  }, []);

  const previewSet = new Set(preview ?? []);
  const last = new Set(state.last?.cells ?? []);
  const label = (cell: number) => {
    const v = board[cell] ?? EMPTY;
    const where = t("cellName", { row: Math.floor(cell / size) + 1, col: (cell % size) + 1 });
    return v === EMPTY
      ? t("cellEmpty", { cell: where })
      : t("cellOwned", { cell: where, name: name(v) });
  };
  const announcement = state.last
    ? t("placed", { name: name(state.last.seat), count: state.last.cells.length })
    : state.moves > 0
      ? t("passed")
      : "";

  return (
    <div className="gsc">
      <style>{KIT_CSS}</style>
      <style>{CSS}</style>
      <ul className="gsc-seats">
        {Array.from({ length: seats }, (_, s) => (
          <li
            key={s}
            style={seatStyle(s)}
            data-turn={!state.over && state.turn === s ? "" : undefined}
          >
            <span className="gsc-chip" aria-hidden="true">
              <SeatShape seat={s} />
            </span>
            {name(s)} <strong>{scoreOf(state, s)}</strong>
          </li>
        ))}
      </ul>
      <div
        className="gsc-board"
        role="grid"
        aria-label={t("boardLabel")}
        style={
          { "--n": String(size), ...(human === null ? {} : seatStyle(human)) } as CSSProperties
        }
        onPointerLeave={() => {
          if (!coarse()) setAnchor(null);
        }}
      >
        {Array.from({ length: size }, (_, r) => (
          <div key={r} role="row" className="gsc-row">
            {Array.from({ length: size }, (__, c) => {
              const cell = r * size + c;
              const v = board[cell] ?? EMPTY;
              const focus = grid.cellProps(cell);
              const start = Array.from({ length: seats }, (___, s) => s).find(
                (s) => !state.started[s] && cornerOf(size, seats, s) === cell,
              );
              return (
                <div
                  key={cell}
                  ref={focus.ref}
                  tabIndex={focus.tabIndex}
                  onFocus={() => {
                    focus.onFocus();
                    setAnchor(cell);
                  }}
                  onKeyDown={focus.onKeyDown}
                  role="gridcell"
                  aria-label={label(cell)}
                  className="gsc-cell"
                  style={
                    v === EMPTY
                      ? start === undefined
                        ? undefined
                        : seatStyle(start)
                      : seatStyle(v)
                  }
                  data-owned={v === EMPTY ? undefined : ""}
                  data-start={start === undefined ? undefined : ""}
                  data-last={last.has(cell) ? "" : undefined}
                  data-preview={previewSet.has(cell) ? (fitsHere ? "fits" : "no") : undefined}
                  onPointerEnter={() => {
                    if (!coarse()) setAnchor(cell);
                  }}
                  onClick={() => {
                    tap(cell);
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="gk-sr" aria-live="polite">
        {anchor !== null && preview ? t(fitsHere ? "previewFits" : "previewNo") : ""}
      </p>
      <div
        className="gsc-tray"
        role="group"
        aria-label={t("rowLabel")}
        style={human === null ? undefined : seatStyle(human)}
      >
        {row.map((shape, index) => (
          <button
            key={`${String(index)}-${String(shape)}`}
            type="button"
            className="gsc-piece"
            aria-pressed={index === slot}
            aria-label={t("pieceLabel", { number: index + 1, count: SHAPES[shape]?.length ?? 0 })}
            onClick={() => {
              choose(index);
            }}
          >
            <Mini cells={index === slot ? cells : shapeCells(shape)} />
          </button>
        ))}
      </div>
      <div className="gk-bar">
        <button
          type="button"
          className="gk-btn"
          onClick={() => {
            turn();
          }}
        >
          {t("rotate")}
        </button>
        <button
          type="button"
          className="gk-btn"
          onClick={() => {
            flipOver();
          }}
        >
          {t("flip")}
        </button>
        {mustPass && (
          <button
            type="button"
            className="gk-btn"
            onClick={() => {
              session.act(human, { type: "pass" });
            }}
          >
            {t("pass")}
          </button>
        )}
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
      {aimed !== null && <p className="gsc-hint">{t("tapAgain")}</p>}
      <p className="gk-sr" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

const CSS = `
.gsc { display: grid; justify-items: center; gap: 0.6rem; width: 100%; user-select: none; -webkit-user-select: none; }
.gsc-seats { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.3rem 0.9rem; margin: 0; padding: 0; list-style: none; }
.gsc-seats li { display: flex; align-items: center; gap: 0.35rem; padding: 0.1rem 0.5rem; border-radius: 999px; font-variant-numeric: tabular-nums; }
.gsc-seats li[data-turn] { box-shadow: 0 0 0 2px var(--fill); }
.gsc-chip { display: grid; place-items: center; width: 1.3rem; height: 1.3rem; border-radius: 50%; background: var(--fill); }
.gsc-chip svg { width: 60%; height: 60%; fill: var(--ink); }
.gsc-board { direction: ltr; display: grid; grid-template-rows: repeat(var(--n), 1fr); width: min(100%, 32rem, calc(100dvh - 21rem)); aspect-ratio: 1; padding: 0.4rem; gap: 1px; border-radius: 0.6rem; background: var(--border-strong); box-sizing: border-box; touch-action: manipulation; }
.gsc-row { display: grid; grid-template-columns: repeat(var(--n), 1fr); gap: 1px; }
.gsc-cell { background: var(--surface); cursor: pointer; }
.gsc-cell[data-owned] { background: var(--fill); box-shadow: inset 0 -2px 0 rgb(0 0 0 / 0.25); }
.gsc-cell[data-start] { background: color-mix(in srgb, var(--fill) 35%, var(--surface)); }
.gsc-cell[data-last] { box-shadow: inset 0 0 0 2px var(--text); }
.gsc-cell[data-preview="fits"] { background: color-mix(in srgb, var(--fill) 70%, var(--surface)); }
.gsc-cell[data-preview="no"] { box-shadow: inset 0 0 0 2px var(--danger); }
.gsc-cell:focus-visible { outline: 3px solid var(--focus); outline-offset: -1px; z-index: 1; }
.gsc-tray { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; }
.gsc-piece { display: grid; place-items: center; width: 4rem; height: 4rem; padding: 0.4rem; border-radius: 0.75rem; border: 1px solid var(--border-strong); background: var(--surface); cursor: pointer; }
.gsc-piece[aria-pressed="true"] { box-shadow: 0 0 0 3px var(--fill); }
.gsc-piece:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.gsc-mini { width: 100%; height: 100%; }
.gsc-mini rect { fill: var(--fill); stroke: rgb(0 0 0 / 0.3); stroke-width: 0.06; }
.gsc-hint { margin: 0; font-weight: 600; }
`;
