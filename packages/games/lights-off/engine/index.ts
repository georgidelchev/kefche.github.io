// Lights Off rules (SPEC §20.3 #26): a grid of lights, some on. Pressing a
// light switches it and its neighbours above, below, left and right. Turn
// every light off. The puzzle comes from the seed by pressing random lights
// on a dark board, so it can always be solved; the fewest presses that solve
// it are worked out over GF(2) and shown at the end. 5 × 5 by default, 4 × 4
// to 7 × 7 as options. Pure and deterministic.
import { Rng, type GameResult, type RaceEngine } from "@kefche/game-sdk";

export const SIZES = [5, 4, 6, 7] as const;
export type Size = (typeof SIZES)[number];

export interface Config {
  size: Size;
}

export interface Action {
  cell: number;
}

export interface State {
  size: Size;
  /** 1 on, 0 off. */
  lights: number[];
  presses: number;
  /** The fewest presses that solve the starting position. */
  fewest: number;
  /** How many were on at the start (for progress). */
  start: number;
}

export const configFrom = (raw: unknown): Config => {
  const size = (raw as { size?: unknown } | null | undefined)?.size;
  return { size: SIZES.find((s) => s === size) ?? 5 };
};

export function press(lights: readonly number[], size: number, cell: number): number[] {
  const out = lights.slice();
  const r = Math.floor(cell / size);
  const c = cell % size;
  for (const [dr, dc] of [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const) {
    const rr = r + dr;
    const cc = c + dc;
    if (rr >= 0 && rr < size && cc >= 0 && cc < size)
      out[rr * size + cc] = 1 - (out[rr * size + cc] ?? 0);
  }
  return out;
}

/**
 * The fewest presses that turn these lights off: Gaussian elimination over
 * GF(2), then the lightest solution among the free variables' choices.
 */
export function fewestPresses(lights: readonly number[], size: number): number {
  const n = size * size;
  // Row i: which presses switch light i, then the light itself.
  const rows = Array.from({ length: n }, (_, i) => {
    const row = new Uint8Array(n + 1);
    const r = Math.floor(i / size);
    const c = i % size;
    for (let j = 0; j < n; j++) {
      const rj = Math.floor(j / size);
      const cj = j % size;
      if (Math.abs(r - rj) + Math.abs(c - cj) <= 1) row[j] = 1;
    }
    row[n] = lights[i] ?? 0;
    return row;
  });
  const pivotOf: number[] = [];
  let rank = 0;
  for (let col = 0; col < n && rank < n; col++) {
    const p = rows.findIndex((row, i) => i >= rank && row[col] === 1);
    if (p < 0) continue;
    [rows[rank], rows[p]] = [rows[p] ?? new Uint8Array(n + 1), rows[rank] ?? new Uint8Array(n + 1)];
    const pivot = rows[rank] ?? new Uint8Array(n + 1);
    rows.forEach((row, i) => {
      if (i !== rank && row[col] === 1)
        for (let k = col; k <= n; k++) row[k] = (row[k] ?? 0) ^ (pivot[k] ?? 0);
    });
    pivotOf[rank] = col;
    rank++;
  }
  const pivots = new Set(pivotOf);
  const free = Array.from({ length: n }, (_, i) => i).filter((i) => !pivots.has(i));
  let best = Infinity;
  for (let mask = 0; mask < 1 << free.length; mask++) {
    const x = new Uint8Array(n);
    free.forEach((v, k) => {
      x[v] = (mask >> k) & 1;
    });
    for (let i = rank - 1; i >= 0; i--) {
      const row = rows[i] ?? new Uint8Array(n + 1);
      const col = pivotOf[i] ?? 0;
      let v = row[n] ?? 0;
      for (let k = col + 1; k < n; k++) if (row[k]) v ^= x[k] ?? 0;
      x[col] = v;
    }
    best = Math.min(
      best,
      x.reduce((s, v) => s + v, 0),
    );
  }
  return best;
}

export const isDark = (lights: readonly number[]) => lights.every((v) => v === 0);

export const engine: RaceEngine<State, Action, Config | undefined> = {
  initialState(config, seed) {
    const { size } = configFrom(config);
    const n = size * size;
    const rng = Rng.fromSeed(`${seed}:lights:${String(size)}`);
    let lights = Array.from({ length: n }, () => 0);
    // Each light pressed or not, at random; again until something is on.
    while (isDark(lights)) {
      for (let cell = 0; cell < n; cell++) if (rng.next() < 0.5) lights = press(lights, size, cell);
    }
    const start = lights.reduce((s, v) => s + v, 0);
    return { size, lights, presses: 0, fewest: fewestPresses(lights, size), start };
  },

  apply(state, { cell }) {
    if (isDark(state.lights) || !Number.isInteger(cell) || cell < 0 || cell >= state.lights.length)
      return state;
    return { ...state, lights: press(state.lights, state.size, cell), presses: state.presses + 1 };
  },

  progress: (state) => 1 - state.lights.reduce((s, v) => s + v, 0) / state.lights.length,

  result: (state): GameResult | null =>
    isDark(state.lights) ? { completed: true, score: state.presses } : null,

  score: (state) => state.presses,
};
