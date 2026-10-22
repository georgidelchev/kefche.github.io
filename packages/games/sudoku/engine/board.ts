// Board geometry and candidate bitmasks. A grid is 81 numbers in reading
// order, 0 for an empty cell. A candidate mask uses bits 1–9 for the digits.

export const CELLS = 81;
/** Bits 1–9 set: every digit possible. */
export const ALL = 0b1111111110;

export const rowOf = (cell: number) => Math.floor(cell / 9);
export const colOf = (cell: number) => cell % 9;
export const boxOf = (cell: number) =>
  Math.floor(rowOf(cell) / 3) * 3 + Math.floor(colOf(cell) / 3);

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const ALL_CELLS = range(CELLS);

/** The 27 units: 9 rows, then 9 columns, then 9 boxes. */
export const UNITS: readonly (readonly number[])[] = [
  ...range(9).map((r) => ALL_CELLS.filter((c) => rowOf(c) === r)),
  ...range(9).map((k) => ALL_CELLS.filter((c) => colOf(c) === k)),
  ...range(9).map((b) => ALL_CELLS.filter((c) => boxOf(c) === b)),
];

/** The 20 cells that share a row, column or box with each cell. */
export const PEERS: readonly (readonly number[])[] = ALL_CELLS.map((cell) =>
  ALL_CELLS.filter(
    (other) =>
      other !== cell &&
      (rowOf(other) === rowOf(cell) ||
        colOf(other) === colOf(cell) ||
        boxOf(other) === boxOf(cell)),
  ),
);

const POPCOUNT = Array.from({ length: 1024 }, (_, mask) => {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
});

/** Number of digits in a mask. */
export const count = (mask: number) => POPCOUNT[mask] ?? 0;

/** The digits in a mask, ascending. */
export function digits(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & (1 << d)) out.push(d);
  return out;
}

/** Digits still possible in an empty cell, given the filled cells of a grid. */
export function candidatesOf(grid: readonly number[], cell: number): number {
  let used = 0;
  for (const peer of PEERS[cell] ?? []) used |= 1 << (grid[peer] ?? 0);
  return ALL & ~used;
}
