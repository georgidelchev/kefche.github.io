// Letter Grid rules (SPEC §20.7 #66; an original name): a 4 × 4 or 5 × 5
// grid of letters and three minutes. Find words by joining letters that
// touch, across, up and down or diagonally, using each square at most once
// a word. A word must be three letters or more and in the language's
// dictionary (`lexiconOf`, ADR-0050). Longer words score more: 3 or 4
// letters 1 point, 5 letters 2, 6 letters 3, 7 letters 5, 8 or more 11.
// The score is the points, higher being better.
//
// - The grid comes from the seed: letters drawn as often as they're used
//   in the language, drawn again (up to 30 times, from the same seed)
//   until the grid holds enough words, so no grid is a dud.
// - A word is sent as its letters; it counts if it can be traced on the
//   grid. Each says when it came (ms after the grid appeared); one within
//   100 ms of the last doesn't count, nor any after the three minutes. A
//   stop ends the run. Every action returns the time since the last from
//   `actionMs`.
// Pure and deterministic, given the word lists.
import {
  charsOf,
  HUMAN,
  lexiconOf,
  measuredMs,
  Rng,
  wordOf,
  type GameResult,
  type Lexicon,
  type LexiconNode,
  type RaceEngine,
} from "@kefche/game-sdk";

export const PACKS = ["en", "bg"] as const;
export type Pack = (typeof PACKS)[number];
export const SIZES = [4, 5] as const;
export type Size = (typeof SIZES)[number];

export interface Config {
  pack: Pack;
  size: Size;
}

export const configFrom = (raw: unknown): Config => {
  const r = raw as { pack?: unknown; size?: unknown } | null | undefined;
  return {
    pack: PACKS.find((p) => p === r?.pack) ?? "en",
    size: r?.size === 5 ? 5 : 4,
  };
};

export const DURATION_MS = 180_000;
export const MIN_LENGTH = 3;
/** The fewest words a grid of each size must hold. */
const ENOUGH: Readonly<Record<Size, number>> = { 4: 40, 5: 90 };

/** Letters as often as they're used (each repeated by its weight). */
const BAG: Readonly<Record<Pack, string>> = {
  en: "eeeeeeeeeeeeaaaaaaaaaiiiiiiiiioooooooonnnnnnrrrrrrttttttllllssssssuuuuddddgggbbccmmppffhhvvwwyykjxqz",
  bg: "ааааааааааооооооооооееееееееиииииииииттттттннннннрррррссссссвввввллллккккдддддпппммммзззяябббггууучъъжжйшцщфхью",
};

export type Action = { word: string; ms: number } | { stop: true };

export interface State {
  pack: Pack;
  size: Size;
  /** The grid, row by row. */
  letters: string[];
  found: string[];
  points: number;
  last: number;
  over: boolean;
}

/** The squares touching a square (across, up and down, and diagonally). */
export function neighbours(size: number, cell: number): number[] {
  const r = Math.floor(cell / size);
  const c = cell % size;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr;
      const cc = c + dc;
      if ((dr !== 0 || dc !== 0) && rr >= 0 && rr < size && cc >= 0 && cc < size)
        out.push(rr * size + cc);
    }
  }
  return out;
}

/** A path of squares spelling `word` on the grid, if there is one. */
export function trace(letters: readonly string[], size: number, word: string): number[] | null {
  const chars = charsOf(word);
  const step = (path: number[]): number[] | null => {
    if (path.length === chars.length) return path;
    const next = chars[path.length];
    const from = path.at(-1);
    const options = from === undefined ? letters.map((_, i) => i) : neighbours(size, from);
    for (const cell of options) {
      if (letters[cell] !== next || path.includes(cell)) continue;
      const done = step([...path, cell]);
      if (done) return done;
    }
    return null;
  };
  return chars.length === 0 ? null : step([]);
}

/** Every word of three letters or more the grid holds, longest first. */
export function gridWords(lexicon: Lexicon, letters: readonly string[], size: number): string[] {
  const out = new Set<string>();
  const walk = (cell: number, node: LexiconNode, used: Set<number>, sofar: string) => {
    const letter = letters[cell] ?? "";
    const next = lexicon.step(node, letter);
    if (!next) return;
    const word = sofar + letter;
    if (next.word && charsOf(word).length >= MIN_LENGTH) out.add(word);
    used.add(cell);
    for (const n of neighbours(size, cell)) if (!used.has(n)) walk(n, next.node, used, word);
    used.delete(cell);
  };
  for (let cell = 0; cell < letters.length; cell++) walk(cell, lexicon.root, new Set(), "");
  return [...out].sort((a, b) => charsOf(b).length - charsOf(a).length || (a < b ? -1 : 1));
}

export function initialState(raw: Config, seed: string): State {
  const { pack, size } = configFrom(raw);
  const rng = Rng.fromSeed(`letter-grid:${pack}:${String(size)}:${seed}`);
  const bag = charsOf(BAG[pack]);
  const lexicon = lexiconOf(pack, "all");
  let letters: string[] = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    letters = Array.from({ length: size * size }, () => rng.pick(bag));
    if (gridWords(lexicon, letters, size).length >= ENOUGH[size]) break;
  }
  return { pack, size, letters, found: [], points: 0, last: 0, over: false };
}

export function pointsFor(word: string): number {
  const n = charsOf(word).length;
  return n <= 4 ? 1 : n === 5 ? 2 : n === 6 ? 3 : n === 7 ? 5 : 11;
}

/** Why a word would or wouldn't count. */
export type Verdict = "ok" | "short" | "path" | "found" | "unknown";

export function judge(s: State, raw: string): Verdict {
  const word = wordOf(s.pack, raw);
  if (word === null || charsOf(word).length < MIN_LENGTH) return "short";
  if (!trace(s.letters, s.size, word)) return "path";
  if (s.found.includes(word)) return "found";
  return lexiconOf(s.pack, "all").has(word) ? "ok" : "unknown";
}

type Read = { word: string; ms: number } | { stop: true };

/** What an action is, checked as it arrived (a replayed log can hold anything). */
function read(s: State, action: unknown): Read | null {
  if (s.over || typeof action !== "object" || action === null) return null;
  if ("stop" in action) return (action as { stop?: unknown }).stop === true ? { stop: true } : null;
  const a = action as { word?: unknown; ms?: unknown };
  const ms = measuredMs(a.ms, DURATION_MS - 1);
  if (typeof a.word !== "string" || ms === null || ms - s.last < HUMAN.reactionMs) return null;
  if (judge(s, a.word) !== "ok") return null;
  return { word: wordOf(s.pack, a.word) ?? "", ms };
}

function apply(s: State, action: Action): State {
  const r = read(s, action);
  if (!r) return s;
  if ("stop" in r) return { ...s, last: DURATION_MS, over: true };
  return { ...s, found: [...s.found, r.word], points: s.points + pointsFor(r.word), last: r.ms };
}

function result(s: State): GameResult | null {
  // No winning here, only a score (like Snake and 2048).
  return s.over ? { completed: false, score: s.points } : null;
}

export const engine: RaceEngine<State, Action, Config> = {
  initialState,
  apply,
  progress: (s) => (s.over ? 1 : s.last / DURATION_MS),
  result,
  score: (s) => s.points,
  actionMs: (s, action) => {
    const r = read(s, action);
    if (!r) return 0;
    return ("stop" in r ? DURATION_MS : r.ms) - s.last;
  },
};
