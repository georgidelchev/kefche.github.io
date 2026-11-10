// Roving focus on a board (WAI-ARIA grid pattern): one cell is in the tab
// order, the arrow keys move it, Enter or Space acts. Boards are never
// mirrored, so left is left in every language.
import { useRef, useState, type KeyboardEvent } from "react";

const STEPS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
};

/**
 * Where a key moves focus on a cols × rows board, or null for other keys.
 * Arrows step over places that aren't cells (isCell, for boards that aren't
 * rectangles); Home and End go to the row's first and last cell.
 */
export function gridStep(
  key: string,
  index: number,
  cols: number,
  rows: number,
  isCell: (index: number) => boolean = () => true,
): number | null {
  const row = Math.floor(index / cols);
  const col = index % cols;
  const step = STEPS[key];
  if (step) {
    let r = row + step[0];
    let c = col + step[1];
    while (r >= 0 && r < rows && c >= 0 && c < cols) {
      if (isCell(r * cols + c)) return r * cols + c;
      r += step[0];
      c += step[1];
    }
    return index;
  }
  if (key === "Home" || key === "End") {
    const order = Array.from({ length: cols }, (_, i) => row * cols + i).filter(isCell);
    return (key === "Home" ? order[0] : order.at(-1)) ?? index;
  }
  return null;
}

export interface GridFocus {
  /** The cell in the tab order. */
  focus: number;
  /** Moves the tab stop to a cell and focuses it. */
  setFocus: (index: number) => void;
  /** Spread onto a cell: its tab stop, ref and key handling. */
  cellProps: (index: number) => {
    ref: (el: HTMLElement | null) => void;
    tabIndex: 0 | -1;
    onFocus: () => void;
    onKeyDown: (e: KeyboardEvent) => void;
  };
}

/** Roving focus over a board's cells; onActivate runs on Enter or Space. */
export function useGridFocus({
  cols,
  rows,
  initial = 0,
  isCell,
  onActivate,
}: {
  cols: number;
  rows: number;
  initial?: number;
  isCell?: (index: number) => boolean;
  onActivate: (index: number) => void;
}): GridFocus {
  const [focus, setFocus] = useState(initial);
  const cells = useRef(new Map<number, HTMLElement>());
  const moveTo = (index: number) => {
    setFocus(index);
    cells.current.get(index)?.focus();
  };
  return {
    focus,
    setFocus: moveTo,
    cellProps: (index) => ({
      ref: (el) => {
        if (el) cells.current.set(index, el);
        else cells.current.delete(index);
      },
      tabIndex: index === focus ? 0 : -1,
      onFocus: () => {
        setFocus(index);
      },
      onKeyDown: (e) => {
        if (e.key === "Enter" || e.key === " ") onActivate(index);
        else {
          const to = gridStep(e.key, index, cols, rows, isCell);
          if (to === null) return;
          moveTo(to);
        }
        e.preventDefault();
      },
    }),
  };
}
