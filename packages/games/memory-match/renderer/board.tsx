// Memory Match's table of cards, shared with Memory Pairs (Phase 12): a
// grid of buttons (Tab or the arrow keys move, Enter or Space flips), face
// up when matched or turned, and a missed pair shown for a moment before it
// looks face down again. Strings come from the game's "ui" keys.
import { useEffect, useState, type CSSProperties } from "react";

import type { GameContext } from "@kefche/game-sdk/browser";
import { useGridFocus } from "@kefche/game-sdk/react";

import { LAYOUT, type Size, type Table } from "../engine";
import { SYMBOLS } from "./symbols";

/** How long a missed pair stays face up. */
export const SHOW_MS = 1100;
const SYMBOL_KEYS = {
  0: "symbol0",
  1: "symbol1",
  2: "symbol2",
  3: "symbol3",
  4: "symbol4",
  5: "symbol5",
  6: "symbol6",
  7: "symbol7",
  8: "symbol8",
  9: "symbol9",
  10: "symbol10",
  11: "symbol11",
  12: "symbol12",
  13: "symbol13",
  14: "symbol14",
} as const;
const symbolKey = (symbol: number) =>
  SYMBOL_KEYS[(symbol % SYMBOLS.length) as keyof typeof SYMBOL_KEYS];

export function Cards({
  context,
  table,
  cards,
  hidden,
  disabled,
  onFlip,
}: {
  context: GameContext;
  table: Table;
  cards: Size;
  /** Cards shown face down although still up (a missed pair after its moment). */
  hidden: readonly number[];
  disabled: boolean;
  onFlip: (card: number) => void;
}) {
  const { t } = context;
  const [cols, rows] = LAYOUT[cards];
  const grid = useGridFocus({
    cols,
    rows,
    initial: 0,
    onActivate: (card) => {
      if (!disabled) onFlip(card);
    },
  });
  return (
    <div
      className="gmm-board"
      role="grid"
      aria-label={t("boardLabel")}
      style={{ "--cols": String(cols), "--rows": String(rows) } as CSSProperties}
    >
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} role="row" className="gmm-row">
          {Array.from({ length: cols }, (__, c) => {
            const card = r * cols + c;
            const symbol = table.symbols[card] ?? 0;
            const faceUp =
              table.matched[card] === true || (table.up.includes(card) && !hidden.includes(card));
            const focus = grid.cellProps(card);
            const art = SYMBOLS[symbol % SYMBOLS.length];
            return (
              <div key={card} role="gridcell" className="gmm-cell">
                <button
                  type="button"
                  ref={focus.ref}
                  tabIndex={focus.tabIndex}
                  onFocus={focus.onFocus}
                  onKeyDown={focus.onKeyDown}
                  className="gmm-card"
                  data-up={faceUp ? "" : undefined}
                  data-matched={table.matched[card] ? "" : undefined}
                  aria-label={
                    faceUp
                      ? t("cardUp", {
                          number: card + 1,
                          symbol: t(symbolKey(symbol)),
                        })
                      : t("cardDown", { number: card + 1 })
                  }
                  aria-disabled={disabled || table.matched[card] ? true : undefined}
                  onClick={() => {
                    if (!disabled) onFlip(card);
                  }}
                >
                  {faceUp && art && (
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      style={{ color: art.colour, fill: art.colour }}
                    >
                      {art.draw}
                    </svg>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** A missed pair turns face down after a moment (only how it looks: the next flip does it for real). */
export function useHiddenMiss(table: Table | null) {
  const [hidden, setHidden] = useState<number[]>([]);
  const key = table?.up.length === 2 ? table.up.join() : "";
  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(() => {
      setHidden(key.split(",").map(Number));
    }, SHOW_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [key]);
  return key ? hidden.filter((c) => key.split(",").map(Number).includes(c)) : [];
}

/** The board's styles (with KIT_CSS). */
export const BOARD_CSS = `
.gmm-board { direction: ltr; display: grid; grid-template-rows: repeat(var(--rows), minmax(0, 1fr)); gap: 0.4rem; width: min(100%, 30rem, calc((100dvh - 16rem) * var(--cols) / var(--rows))); aspect-ratio: var(--cols) / var(--rows); }
.gmm-row { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 0.4rem; }
.gmm-cell { display: grid; }
.gmm-card { display: grid; place-items: center; width: 100%; height: 100%; padding: 12%; border-radius: 0.6rem; border: 2px solid #1e3a8a; background: repeating-linear-gradient(45deg, #2b4fb3 0 6px, #3560d0 6px 12px); cursor: pointer; transition: transform 0.15s; }
.gmm-card[data-up] { background: #fffdf7; border-color: #c9c2b0; }
.gmm-card[data-matched] { background: #eef7ef; border-color: #6fbf73; cursor: default; }
.gmm-card[aria-disabled] { cursor: default; }
.gmm-card:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.gmm-card svg { width: 100%; height: 100%; }
@media (prefers-reduced-motion: no-preference) { .gmm-card:not([aria-disabled]):active { transform: scale(0.95); } }
`;
