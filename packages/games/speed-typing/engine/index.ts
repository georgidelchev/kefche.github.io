// Speed Typing rules (SPEC §20.7 #64): type a passage exactly, word by word,
// as fast as you can. The score is words per minute (a word being five
// characters, spaces included), higher being better; accuracy is shown
// beside it.
//
// - The passage comes from the seed, from the language's texts: passages
//   from public-domain classics and sentences written for kefche (Q4).
//   "Short" is its first sentences up to 20 words or more (from passages
//   where that is 35 words at most); "long" is all of it.
// - A word is sent once typed exactly (the next must follow it), with when
//   it was finished (ms from the first key pressed) and how many wrong keys
//   were pressed on the way. A word finished faster than 30 ms a character
//   (about 400 words a minute) doesn't count, nor any after ten minutes.
// - The last word ends the run with its score. A stop ends it unfinished,
//   with no score: a race's speed is over the whole passage.
// Pure and deterministic.
import { charsOf, measuredMs, Rng, type GameResult, type RaceEngine } from "@kefche/game-sdk";

import bg from "../content/bg.json";
import en from "../content/en.json";

export const PACKS = ["en", "bg"] as const;
export type Pack = (typeof PACKS)[number];
export const LENGTHS = ["short", "long"] as const;
export type Length = (typeof LENGTHS)[number];

export interface Config {
  pack: Pack;
  length: Length;
}

export const configFrom = (raw: unknown): Config => {
  const r = raw as { pack?: unknown; length?: unknown } | null | undefined;
  return {
    pack: PACKS.find((p) => p === r?.pack) ?? "en",
    length: r?.length === "long" ? "long" : "short",
  };
};

export interface Passage {
  text: string;
  /** Author and work for a classic; none for a passage written for kefche. */
  source?: string;
}

export const PASSAGES: Readonly<Record<Pack, readonly Passage[]>> = {
  en: en.passages,
  bg: bg.passages,
};

/** A short text runs to the end of the sentence that reaches this many words. */
export const SHORT_WORDS = 20;
/** Short texts come only from passages whose opening runs no longer than this. */
export const SHORT_MAX = 35;
/** The fastest a character can count: 30 ms (about 400 words a minute). */
export const MIN_CHAR_MS = 30;
/** No word counts after ten minutes. */
export const MAX_MS = 600_000;
/** The most wrong keys a word can report. */
const MAX_TYPOS = 99;

export type Action = { word: string; ms: number; typos: number } | { stop: true };

export interface State {
  pack: Pack;
  length: Length;
  /** Which of the language's passages. */
  passage: number;
  /** The words to type, in order. */
  words: string[];
  /** Words typed so far. */
  done: number;
  /** Wrong keys pressed. */
  typos: number;
  /** When the last word was finished (ms from the first key). */
  last: number;
  over: boolean;
}

/** The words of a passage at a length. */
export function wordsFor(text: string, length: Length): string[] {
  const words = text.split(" ").filter((w) => w !== "");
  if (length === "long") return words;
  for (let i = SHORT_WORDS - 1; i < words.length; i++) {
    if (/[.!?]$/.test(words[i] ?? "")) return words.slice(0, i + 1);
  }
  return words;
}

export function initialState(raw: Config, seed: string): State {
  const { pack, length } = configFrom(raw);
  const rng = Rng.fromSeed(`speed-typing:${pack}:${length}:${seed}`);
  const all = PASSAGES[pack].map((_, i) => i);
  const fits = all.filter(
    (i) => wordsFor(PASSAGES[pack][i]?.text ?? "", "short").length <= SHORT_MAX,
  );
  const passage = rng.pick(length === "short" ? fits : all);
  const words = wordsFor(PASSAGES[pack][passage]?.text ?? "", length);
  return { pack, length, passage, words, done: 0, typos: 0, last: 0, over: false };
}

/** Characters typed correctly: the words done and the spaces between them. */
export const charsDone = (s: State): number =>
  s.words.slice(0, s.done).reduce((n, w) => n + charsOf(w).length, 0) + Math.max(0, s.done - 1);

/** Words a minute over `ms` (a word is five characters). */
export const wpm = (chars: number, ms: number): number =>
  ms <= 0 ? 0 : Math.round(chars / 5 / (ms / 60_000));

/** Share of keys pressed that were right, 0 to 100. */
export function accuracy(s: State): number {
  const chars = charsDone(s);
  return chars + s.typos === 0 ? 100 : Math.round((chars / (chars + s.typos)) * 100);
}

export const finished = (s: State): boolean => s.done === s.words.length;

type Read = { word: string; ms: number; typos: number } | { stop: true };

/** What an action is, checked as it arrived (a replayed log can hold anything). */
function read(s: State, action: unknown): Read | null {
  if (s.over || typeof action !== "object" || action === null) return null;
  if ("stop" in action) return (action as { stop?: unknown }).stop === true ? { stop: true } : null;
  const a = action as { word?: unknown; ms?: unknown; typos?: unknown };
  const ms = measuredMs(a.ms, MAX_MS);
  const typos = measuredMs(a.typos, MAX_TYPOS);
  const word = s.words[s.done];
  if (a.word !== word || word === undefined || ms === null || typos === null) return null;
  const chars = charsOf(word).length + (s.done > 0 ? 1 : 0);
  if (ms - s.last < chars * MIN_CHAR_MS) return null;
  return { word, ms, typos };
}

function apply(s: State, action: Action): State {
  const r = read(s, action);
  if (!r) return s;
  if ("stop" in r) return { ...s, over: true };
  const done = s.done + 1;
  return { ...s, done, typos: s.typos + r.typos, last: r.ms, over: done === s.words.length };
}

/** The score: words a minute over the whole text, once it's all typed. */
const scoreOf = (s: State): number => (finished(s) ? wpm(charsDone(s), s.last) : 0);

function result(s: State): GameResult | null {
  // No winning here, only a speed (like the other speed games).
  return s.over ? { completed: false, score: scoreOf(s) } : null;
}

export const engine: RaceEngine<State, Action, Config> = {
  initialState,
  apply,
  progress: (s) => (s.words.length === 0 ? 1 : s.done / s.words.length),
  result,
  score: scoreOf,
  actionMs: (s, action) => {
    const r = read(s, action);
    return r && !("stop" in r) ? r.ms - s.last : 0;
  },
};
