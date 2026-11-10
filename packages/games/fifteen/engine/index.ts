// 15 Puzzle rules (SPEC §20.3 #25): numbered tiles in a 3 × 3, 4 × 4 or
// 5 × 5 frame with one gap. Sliding a tile in the gap's row or column moves
// it (and the tiles between) one place toward the gap. Put the tiles in
// order, the gap last. The start comes from the seed by sliding at random
// from the solved position, so it can always be solved. Pure and
// deterministic.
import { Rng, type GameResult, type RaceEngine } from "@kefche/game-sdk";

export const SIZES = [4, 3, 5] as const;
export type Size = (typeof SIZES)[number];

export interface Config {
  size: Size;
}

export interface Action {
  /** The tile's cell; it and the tiles between slide toward the gap. */
  cell: number;
}

export interface State {
  size: Size;
  /** Tile numbers by cell, 0 for the gap. */
  tiles: number[];
  moves: number;
}

export const configFrom = (raw: unknown): Config => {
  const size = (raw as { size?: unknown } | null | undefined)?.size;
  return { size: SIZES.find((s) => s === size) ?? 4 };
};

export const isSolved = (tiles: readonly number[]) =>
  tiles.every((t, i) => (i === tiles.length - 1 ? t === 0 : t === i + 1));

/** The tiles after sliding the line from `cell` to the gap, or null when it can't move. */
export function slide(tiles: readonly number[], size: number, cell: number): number[] | null {
  const gap = tiles.indexOf(0);
  if (cell === gap || cell < 0 || cell >= tiles.length) return null;
  const [gr, gc] = [Math.floor(gap / size), gap % size];
  const [r, c] = [Math.floor(cell / size), cell % size];
  if (r !== gr && c !== gc) return null;
  const step = r === gr ? (c < gc ? -1 : 1) : c === gc ? (r < gr ? -size : size) : 0;
  const out = tiles.slice();
  let at = gap;
  while (at !== cell) {
    out[at] = out[at + step] ?? 0;
    at += step;
  }
  out[cell] = 0;
  return out;
}

export const engine: RaceEngine<State, Action, Config | undefined> = {
  initialState(config, seed) {
    const { size } = configFrom(config);
    const n = size * size;
    let tiles = Array.from({ length: n }, (_, i) => (i === n - 1 ? 0 : i + 1));
    const rng = Rng.fromSeed(`${seed}:fifteen:${String(size)}`);
    let previous = -1;
    // Random slides of one tile, never straight back.
    for (let i = 0; i < n * 30 || isSolved(tiles); i++) {
      const gap = tiles.indexOf(0);
      const near = [
        gap - size,
        gap + size,
        gap % size > 0 ? gap - 1 : -1,
        gap % size < size - 1 ? gap + 1 : -1,
      ].filter((c) => c >= 0 && c < n && c !== previous);
      const cell = rng.pick(near);
      tiles = slide(tiles, size, cell) ?? tiles;
      previous = gap;
    }
    return { size, tiles, moves: 0 };
  },

  apply(state, action) {
    if (isSolved(state.tiles) || !Number.isInteger(action.cell)) return state;
    const tiles = slide(state.tiles, state.size, action.cell);
    return tiles ? { ...state, tiles, moves: state.moves + 1 } : state;
  },

  progress: (state) =>
    state.tiles.filter((t, i) => t !== 0 && t === i + 1).length / (state.tiles.length - 1),

  result: (state): GameResult | null =>
    isSolved(state.tiles) ? { completed: true, score: state.moves } : null,

  score: (state) => state.moves,
};
