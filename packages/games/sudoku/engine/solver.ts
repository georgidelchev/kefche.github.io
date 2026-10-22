// Backtracking solver on row/column/box bitmasks, always branching on the
// cell with the fewest candidates. Fast enough to check uniqueness after
// every removal while a puzzle is generated.
import type { Rng } from "@kefche/game-sdk";

import { ALL, boxOf, CELLS, colOf, count, rowOf } from "./board";

/**
 * Explores solutions of `grid` and calls `onSolution` for each; stops when it
 * returns true. Digits are tried in `order` (a shuffled order gives random
 * grids). Returns false for a grid that breaks the rules.
 */
function search(
  grid: readonly number[],
  order: readonly number[],
  onSolution: (cells: number[]) => boolean,
): boolean {
  const cells = [...grid];
  const rows = new Array<number>(9).fill(0);
  const cols = new Array<number>(9).fill(0);
  const boxes = new Array<number>(9).fill(0);
  for (let c = 0; c < CELLS; c++) {
    const v = cells[c] ?? 0;
    if (!v) continue;
    const bit = 1 << v;
    const r = rowOf(c);
    const k = colOf(c);
    const b = boxOf(c);
    if (((rows[r] ?? 0) | (cols[k] ?? 0) | (boxes[b] ?? 0)) & bit) return false;
    rows[r] = (rows[r] ?? 0) | bit;
    cols[k] = (cols[k] ?? 0) | bit;
    boxes[b] = (boxes[b] ?? 0) | bit;
  }

  const step = (): boolean => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let c = 0; c < CELLS; c++) {
      if (cells[c]) continue;
      const mask = ALL & ~((rows[rowOf(c)] ?? 0) | (cols[colOf(c)] ?? 0) | (boxes[boxOf(c)] ?? 0));
      const n = count(mask);
      if (n === 0) return false;
      if (n < bestCount) {
        best = c;
        bestMask = mask;
        bestCount = n;
        if (n === 1) break;
      }
    }
    if (best === -1) return onSolution(cells);
    const r = rowOf(best);
    const k = colOf(best);
    const b = boxOf(best);
    for (const d of order) {
      const bit = 1 << d;
      if (!(bestMask & bit)) continue;
      cells[best] = d;
      rows[r] = (rows[r] ?? 0) | bit;
      cols[k] = (cols[k] ?? 0) | bit;
      boxes[b] = (boxes[b] ?? 0) | bit;
      if (step()) return true;
      cells[best] = 0;
      rows[r] = (rows[r] ?? 0) & ~bit;
      cols[k] = (cols[k] ?? 0) & ~bit;
      boxes[b] = (boxes[b] ?? 0) & ~bit;
    }
    return false;
  };
  step();
  return true;
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Number of solutions, counting no further than `limit`. */
export function countSolutions(grid: readonly number[], limit = 2): number {
  let found = 0;
  search(grid, DIGITS, () => ++found >= limit);
  return found;
}

function first(grid: readonly number[], order: readonly number[]): number[] | undefined {
  const found: number[][] = [];
  search(grid, order, (cells) => found.push([...cells]) > 0);
  return found[0];
}

/** The first solution, or null. */
export const solve = (grid: readonly number[]): number[] | null => first(grid, DIGITS) ?? null;

/** A random complete grid. */
export function randomFullGrid(rng: Rng): number[] {
  // A shuffled first row, then digits tried in a shuffled order, gives varied
  // grids at no cost.
  const start = [...rng.shuffle(DIGITS), ...new Array<number>(CELLS - 9).fill(0)];
  const grid = first(start, rng.shuffle(DIGITS));
  if (!grid) throw new Error("No grid completes a valid first row");
  return grid;
}
