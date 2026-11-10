// Nonogram rules (SPEC §20.3 #24): fill cells so that each row and column
// shows the runs of filled cells its clue lists, in order, with at least one
// gap between runs. 5 × 5, 10 × 10 (the default) or 15 × 15. Crosses are
// notes for cells you know are empty; the puzzle is solved when the filled
// cells match the picture.
//
// Pictures come from the seed and are kept only if a line solver (each row
// or column on its own, again and again) can finish them, so every puzzle
// has one solution reachable by logic alone. Pure and deterministic.
import { Rng, type GameResult, type RaceEngine } from "@kefche/game-sdk";

export const SIZES = [10, 5, 15] as const;
export type Size = (typeof SIZES)[number];

export interface Config {
  size: Size;
}

/** 0 empty, 1 filled, 2 crossed (a note). */
export interface Action {
  cell: number;
  mark: 0 | 1 | 2;
}

export interface State {
  size: Size;
  solution: number[];
  rowClues: number[][];
  colClues: number[][];
  marks: number[];
  moves: number;
}

export const configFrom = (raw: unknown): Config => {
  const size = (raw as { size?: unknown } | null | undefined)?.size;
  return { size: SIZES.find((s) => s === size) ?? 10 };
};

export const clueOf = (line: readonly number[]): number[] => {
  const runs: number[] = [];
  let run = 0;
  for (const v of line) {
    if (v === 1) run++;
    else if (run > 0) {
      runs.push(run);
      run = 0;
    }
  }
  if (run > 0) runs.push(run);
  return runs;
};

const rowOf = (cells: readonly number[], size: number, r: number) =>
  cells.slice(r * size, r * size + size);
const colOf = (cells: readonly number[], size: number, c: number) =>
  Array.from({ length: size }, (_, r) => cells[r * size + c] ?? 0);

/**
 * What a line's clue allows each cell to be, given what's known (-1 unknown,
 * 0 empty, 1 filled): -1 when both are possible, else the forced value; null
 * when nothing fits.
 */
export function solveLine(clue: readonly number[], known: readonly number[]): number[] | null {
  const n = known.length;
  const k = clue.length;
  // fits[i][j]: cells i.. can hold runs j.. (memoized, -1 unknown).
  const memo = new Int8Array((n + 2) * (k + 1)).fill(-1);
  const fits = (i: number, j: number): boolean => {
    if (i > n) return false;
    const key = i * (k + 1) + j;
    const m = memo[key];
    if (m !== undefined && m !== -1) return m === 1;
    let ok = false;
    if (j === k) {
      ok = true;
      for (let x = i; x < n; x++) if (known[x] === 1) ok = false;
    } else {
      if (i < n && known[i] !== 1 && fits(i + 1, j)) ok = true;
      const len = clue[j] ?? 0;
      if (!ok && i + len <= n) {
        let place = true;
        for (let x = i; x < i + len; x++) if (known[x] === 0) place = false;
        if (place && i + len < n && known[i + len] === 1) place = false;
        if (place) ok = i + len === n ? j + 1 === k : fits(i + len + 1, j + 1);
      }
    }
    memo[key] = ok ? 1 : 0;
    return ok;
  };
  if (!fits(0, 0)) return null;
  const can0 = new Uint8Array(n);
  const can1 = new Uint8Array(n);
  // Walk every reachable state that still fits, noting what each cell can be.
  const seen = new Uint8Array((n + 2) * (k + 1));
  const stack: [number, number][] = [[0, 0]];
  while (stack.length > 0) {
    const [i, j] = stack.pop() ?? [0, 0];
    const key = i * (k + 1) + j;
    if (seen[key] || !fits(i, j)) continue;
    seen[key] = 1;
    if (j === k) {
      for (let x = i; x < n; x++) can0[x] = 1;
      continue;
    }
    if (i < n && known[i] !== 1 && fits(i + 1, j)) {
      can0[i] = 1;
      stack.push([i + 1, j]);
    }
    const len = clue[j] ?? 0;
    if (i + len <= n) {
      let place = true;
      for (let x = i; x < i + len; x++) if (known[x] === 0) place = false;
      if (place && i + len < n && known[i + len] === 1) place = false;
      const next: [number, number] = i + len === n ? [n, j + 1] : [i + len + 1, j + 1];
      if (place && (i + len === n ? j + 1 === k : fits(next[0], next[1]))) {
        for (let x = i; x < i + len; x++) can1[x] = 1;
        if (i + len < n) can0[i + len] = 1;
        stack.push(next);
      }
    }
  }
  return Array.from({ length: n }, (_, x) => (can0[x] && can1[x] ? -1 : can1[x] ? 1 : 0));
}

/** Whether the line solver finishes the puzzle from its clues alone. */
export function lineSolvable(rowClues: number[][], colClues: number[][], size: number): boolean {
  const grid = new Array<number>(size * size).fill(-1);
  for (let pass = 0; pass < size * size; pass++) {
    let changed = false;
    for (let r = 0; r < size; r++) {
      const line = solveLine(rowClues[r] ?? [], rowOf(grid, size, r));
      if (!line) return false;
      for (const [c, v] of line.entries()) {
        if (v !== -1 && grid[r * size + c] === -1) {
          grid[r * size + c] = v;
          changed = true;
        }
      }
    }
    for (let c = 0; c < size; c++) {
      const line = solveLine(colClues[c] ?? [], colOf(grid, size, c));
      if (!line) return false;
      for (const [r, v] of line.entries()) {
        if (v !== -1 && grid[r * size + c] === -1) {
          grid[r * size + c] = v;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return grid.every((v) => v !== -1);
}

const ATTEMPTS = 300;

export function makePuzzle(
  seed: string,
  size: Size,
): Pick<State, "solution" | "rowClues" | "colClues"> {
  let best: Pick<State, "solution" | "rowClues" | "colClues"> | null = null;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const rng = Rng.fromSeed(`${seed}:nonogram:${String(size)}:${String(attempt)}`);
    // Random blobs: noise, then each cell follows the majority around it.
    const noise = Array.from({ length: size * size }, () => (rng.next() < 0.58 ? 1 : 0));
    const solution = noise.map((v, i) => {
      const r = Math.floor(i / size);
      const c = i % size;
      let on = v * 2;
      let all = 2;
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        on += noise[rr * size + cc] ?? 0;
        all++;
      }
      return on * 2 >= all ? 1 : 0;
    });
    const rowClues = Array.from({ length: size }, (_, r) => clueOf(rowOf(solution, size, r)));
    const colClues = Array.from({ length: size }, (_, c) => clueOf(colOf(solution, size, c)));
    best = { solution, rowClues, colClues };
    if (lineSolvable(rowClues, colClues, size)) return best;
  }
  return best ?? { solution: [], rowClues: [], colClues: [] };
}

const solved = (s: State) => s.solution.every((v, i) => (v === 1) === (s.marks[i] === 1));

export const engine: RaceEngine<State, Action, Config | undefined> = {
  initialState(config, seed) {
    const { size } = configFrom(config);
    return {
      size,
      ...makePuzzle(seed, size),
      marks: new Array<number>(size * size).fill(0),
      moves: 0,
    };
  },

  apply(state, { cell, mark }) {
    if (solved(state) || !Number.isInteger(cell) || cell < 0 || cell >= state.marks.length)
      return state;
    // A logged action comes from outside: check the mark too.
    const m: number = mark;
    if (m !== 0 && m !== 1 && m !== 2) return state;
    if (state.marks[cell] === mark) return state;
    const marks = state.marks.slice();
    marks[cell] = mark;
    return { ...state, marks, moves: state.moves + 1 };
  },

  progress(state) {
    const total = state.solution.reduce((n, v) => n + v, 0);
    const right = state.solution.reduce(
      (n, v, i) => n + (v === 1 && state.marks[i] === 1 ? 1 : 0),
      0,
    );
    const wrong = state.solution.reduce(
      (n, v, i) => n + (v === 0 && state.marks[i] === 1 ? 1 : 0),
      0,
    );
    return Math.max(0, right - wrong) / Math.max(1, total);
  },

  result: (state): GameResult | null => (solved(state) ? { completed: true } : null),
};
