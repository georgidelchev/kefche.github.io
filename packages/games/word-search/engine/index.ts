// Word Search rules (SPEC §20.7 #65): a square grid of letters hides words
// from one theme, written in a straight line in any of the eight
// directions (forwards, backwards, up, down and diagonally); the theme and
// its words are listed. Find each word and mark it by selecting its first
// and last letters. The puzzle is solved when every word is found.
//
// - The grid comes from the seed (a race's grid is everyone's): a theme,
//   its words that fit, placed one by one (crossing where letters agree),
//   and the empty cells filled with the language's letters, weighted as
//   they're common, so the filler looks like words.
// - Sizes: 8 × 8 with 6 words, 10 × 10 with 8, 12 × 12 with 10.
// - A selection must be a straight line spelling a word still to find, in
//   either direction; anything else changes nothing.
// Pure and deterministic.
import { charsOf, Rng, type GameResult, type RaceEngine } from "@kefche/game-sdk";

import bg from "../content/bg.json";
import en from "../content/en.json";

export const PACKS = ["en", "bg"] as const;
export type Pack = (typeof PACKS)[number];
export const SIZES = [10, 8, 12] as const;
export type Size = (typeof SIZES)[number];

export interface Config {
  pack: Pack;
  size: Size;
}

export const configFrom = (raw: unknown): Config => {
  const r = raw as { pack?: unknown; size?: unknown } | null | undefined;
  return {
    pack: PACKS.find((p) => p === r?.pack) ?? "en",
    size: SIZES.find((s) => s === r?.size) ?? 10,
  };
};

/** Words hidden in a grid of each size. */
export const WORDS_FOR: Readonly<Record<Size, number>> = { 8: 6, 10: 8, 12: 10 };

const THEMES: Readonly<Record<Pack, readonly { id: string; words: readonly string[] }[]>> = {
  en: en.categories,
  bg: bg.categories,
};
/** The themes' ids, the same in every pack. */
export const THEME_IDS = en.categories.map((c) => c.id);

/** Filler letters, most common first, repeated by how common they are. */
const FILLER: Readonly<Record<Pack, string>> = {
  en: "eeeeeeeeeeeeaaaaaaaaarrrrrrrriiiiiiiioooooooottttttttnnnnnnnsssssslllllcccccuuuudddppmmhhggbbffyywkvxzjq",
  bg: "ааааааааооооооооееееееееииииииииттттттнннннннррррррссссссвввввллллкккккдддддпппппммммззззяяяббггууччъъжжйшщцфхьюя",
};

/** The eight directions, as [row step, column step]. */
export const DIRECTIONS: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [1, -1],
];

export interface Placed {
  word: string;
  /** Its first and last cells (row * size + column). */
  from: number;
  to: number;
}

export interface Action {
  from: number;
  to: number;
}

export interface State {
  pack: Pack;
  size: Size;
  theme: number;
  /** The grid, row by row. */
  letters: string[];
  words: Placed[];
  /** Where each word was found (its first and last cells as selected), or null. */
  found: (Action | null)[];
  /** Selections that matched nothing (for the summary). */
  misses: number;
}

/** Tries to place a word; returns its cells, or null if it doesn't fit there. */
function fit(
  grid: (string | null)[],
  size: number,
  word: string[],
  row: number,
  col: number,
  [dr, dc]: readonly [number, number],
): number[] | null {
  const cells: number[] = [];
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    if (r < 0 || r >= size || c < 0 || c >= size) return null;
    const cell = r * size + c;
    const there = grid[cell];
    if (there !== null && there !== word[i]) return null;
    cells.push(cell);
  }
  return cells;
}

export function initialState(raw: Config, seed: string): State {
  const { pack, size } = configFrom(raw);
  const rng = Rng.fromSeed(`word-search:${pack}:${String(size)}:${seed}`);
  const theme = rng.int(0, THEMES[pack].length - 1);
  const pool = rng.shuffle(
    (THEMES[pack][theme]?.words ?? []).filter((w) => charsOf(w).length <= size),
  );
  const grid: (string | null)[] = Array.from({ length: size * size }, () => null);
  const words: Placed[] = [];
  for (const word of pool) {
    if (words.length >= WORDS_FOR[size]) break;
    const letters = charsOf(word);
    // Random spots and directions until one fits (most do within a few tries).
    for (let attempt = 0; attempt < 300; attempt++) {
      const dir = DIRECTIONS[rng.int(0, DIRECTIONS.length - 1)] ?? [0, 1];
      const cells = fit(grid, size, letters, rng.int(0, size - 1), rng.int(0, size - 1), dir);
      if (!cells) continue;
      cells.forEach((cell, i) => {
        grid[cell] = letters[i] ?? null;
      });
      words.push({ word, from: cells[0] ?? 0, to: cells.at(-1) ?? 0 });
      break;
    }
  }
  const filler = charsOf(FILLER[pack]);
  const letters = grid.map((l) => l ?? rng.pick(filler));
  return { pack, size, theme, letters, words, found: words.map(() => null), misses: 0 };
}

/** The cells from one cell to another, if they make a straight line (in one of the eight directions). */
export function line(size: number, from: number, to: number): number[] | null {
  const r0 = Math.floor(from / size);
  const c0 = from % size;
  const dr = Math.floor(to / size) - r0;
  const dc = (to % size) - c0;
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  const sr = Math.sign(dr);
  const sc = Math.sign(dc);
  return Array.from({ length: steps + 1 }, (_, i) => (r0 + sr * i) * size + c0 + sc * i);
}

export const isSolved = (s: State): boolean => s.found.every((f) => f !== null);

/**
 * The word a selection marks, if any: a word still to find that its letters
 * spell, either way round (wherever it is, even where the filler happens
 * to spell it again).
 */
export function matched(s: State, from: number, to: number): number | null {
  const cells = line(s.size, from, to);
  if (!cells) return null;
  const spelled = cells.map((c) => s.letters[c] ?? "").join("");
  const back = [...cells]
    .reverse()
    .map((c) => s.letters[c] ?? "")
    .join("");
  const index = s.words.findIndex(
    (w, i) => s.found[i] === null && (w.word === spelled || w.word === back),
  );
  return index < 0 ? null : index;
}

// A replayed log can hold anything, so the action is checked as it arrived.
function apply(s: State, raw: Action): State {
  const action: unknown = raw;
  if (isSolved(s) || typeof action !== "object" || action === null) return s;
  const { from, to } = action as { from?: unknown; to?: unknown };
  const n = s.size * s.size;
  if (
    typeof from !== "number" ||
    typeof to !== "number" ||
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= n ||
    to >= n ||
    from === to ||
    !line(s.size, from, to)
  )
    return s;
  const index = matched(s, from, to);
  if (index === null) return { ...s, misses: s.misses + 1 };
  return { ...s, found: s.found.map((f, i) => (i === index ? { from, to } : f)) };
}

function result(s: State): GameResult | null {
  return isSolved(s) ? { completed: true } : null;
}

export const engine: RaceEngine<State, Action, Config> = {
  initialState,
  apply,
  progress: (s) => s.found.filter((f) => f !== null).length / Math.max(1, s.words.length),
  result,
};
