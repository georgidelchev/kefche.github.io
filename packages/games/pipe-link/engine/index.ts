// Pipe Link rules (SPEC §20.3 #29): join each pair of dots of the same
// colour with a pipe through neighbouring cells, so that every cell holds a
// pipe. Pipes can't cross or share a cell. 5 × 5 to 9 × 9 (6 × 6 by
// default).
//
// Puzzles come from a bank made in advance (bank.gen.ts, by
// scripts/pipe-link-bank.mjs with generate.ts): each one checked by a solver
// to have exactly one solution. The seed picks a puzzle for the size, turns
// or flips it, and shuffles its colours, so the same seed always gives the
// same puzzle. Pure and deterministic.
import { Rng, type GameResult, type RaceEngine } from "@kefche/game-sdk";

import { BANK } from "./bank.gen";

export const SIZES = [6, 5, 7, 8, 9] as const;
export type Size = (typeof SIZES)[number];

export interface Config {
  size: Size;
}

/** A colour's whole pipe as drawn, from one of its dots. */
export interface Action {
  colour: number;
  cells: number[];
}

export interface State {
  size: Size;
  /** Each colour's two dots. */
  ends: [number, number][];
  /** Each colour's pipe, from a dot; empty when not drawn. */
  paths: number[][];
  moves: number;
}

export const configFrom = (raw: unknown): Config => {
  const size = (raw as { size?: unknown } | null | undefined)?.size;
  return { size: SIZES.find((s) => s === size) ?? 6 };
};

export const adjacent = (a: number, b: number, size: number) => {
  const dr = Math.abs(Math.floor(a / size) - Math.floor(b / size));
  const dc = Math.abs((a % size) - (b % size));
  return dr + dc === 1;
};

/** A cell turned or flipped by one of the square's eight symmetries. */
function transform(cell: number, size: number, t: number): number {
  let r = Math.floor(cell / size);
  let c = cell % size;
  const last = size - 1;
  if (t & 1) [r, c] = [c, r];
  if (t & 2) r = last - r;
  if (t & 4) c = last - c;
  return r * size + c;
}

export function puzzleFor(size: Size, seed: string): [number, number][] {
  const list = BANK[size] ?? [];
  const rng = Rng.fromSeed(`${seed}:pipe-link:${String(size)}`);
  const base = list[rng.int(0, Math.max(0, list.length - 1))] ?? [];
  const t = rng.int(0, 7);
  return rng.shuffle(
    base.map(([a, b]) => [transform(a, size, t), transform(b, size, t)] as [number, number]),
  );
}

export const connected = (state: State, colour: number) => {
  const path = state.paths[colour] ?? [];
  const [a, b] = state.ends[colour] ?? [-1, -1];
  return (
    path.length >= 2 &&
    ((path[0] === a && path.at(-1) === b) || (path[0] === b && path.at(-1) === a))
  );
};

const covered = (state: State) => {
  const cells = new Set<number>();
  for (const p of state.paths) for (const c of p) cells.add(c);
  return cells.size;
};

const solved = (state: State) =>
  state.ends.every((_, k) => connected(state, k)) && covered(state) === state.size * state.size;

/** The path cleaned up and checked: null when it can't be drawn. */
function validPath(state: State, colour: number, cells: readonly number[]): number[] | null {
  const pair = state.ends[colour];
  if (!pair || cells.length === 0) return null;
  const n = state.size * state.size;
  const [a, b] = pair;
  if (cells[0] !== a && cells[0] !== b) return null;
  const otherEnd = cells[0] === a ? b : a;
  const others = new Set(state.ends.flatMap((e, k) => (k === colour ? [] : e)));
  const seen = new Set<number>();
  const out: number[] = [];
  for (const [i, cell] of cells.entries()) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= n || seen.has(cell) || others.has(cell))
      return null;
    if (i > 0 && !adjacent(out.at(-1) ?? -1, cell, state.size)) return null;
    // Through its own first dot again, or past its second dot: not allowed.
    if (i > 0 && cell === cells[0]) return null;
    seen.add(cell);
    out.push(cell);
    if (cell === otherEnd) return i === cells.length - 1 ? out : null;
  }
  return out;
}

export const engine: RaceEngine<State, Action, Config | undefined> = {
  initialState(config, seed) {
    const { size } = configFrom(config);
    const ends = puzzleFor(size, seed);
    return { size, ends, paths: ends.map(() => []), moves: 0 };
  },

  apply(state, { colour, cells }) {
    if (solved(state) || !Number.isInteger(colour) || !Array.isArray(cells)) return state;
    const path = validPath(state, colour, cells);
    if (!path) return state;
    const mine = new Set(path);
    // Other pipes are cut where this one crosses them.
    const paths = state.paths.map((p, k) => {
      if (k === colour) return path.length === 1 ? [] : path;
      const cut = p.findIndex((c) => mine.has(c));
      return cut < 0 ? p : p.slice(0, cut).length < 2 ? [] : p.slice(0, cut);
    });
    return { ...state, paths, moves: state.moves + 1 };
  },

  progress: (state) =>
    (state.ends.filter((_, k) => connected(state, k)).length / Math.max(1, state.ends.length) +
      covered(state) / (state.size * state.size)) /
    2,

  result: (state): GameResult | null =>
    solved(state) ? { completed: true, score: state.moves } : null,
};
