// Word of the Day rules (SPEC §20.7 #62): guess a five-letter word in six
// tries. Each guess must be a word (the language's full list, ADR-0050) and
// is marked letter by letter: in the right place, in the word elsewhere, or
// not in it. A letter the word holds once is marked once: right places
// first, then the first other copies left to right.
//
// - The daily game takes the day's word from its config (the same for
//   everyone, from the server: words_of_the_day). Practice, and a race in a
//   room, pick one from the language's answers by the seed.
// - Solving it scores 7 less the guesses (6 for the first try, 1 for the
//   sixth); six misses score nothing.
// Pure and deterministic.
import {
  charsOf,
  lexiconOf,
  Rng,
  wordOf,
  type GameResult,
  type RaceEngine,
  type WordLang,
} from "@kefche/game-sdk";

import bg from "../content/bg.json";
import en from "../content/en.json";

export const PACKS = ["en", "bg"] as const satisfies readonly WordLang[];
export type Pack = (typeof PACKS)[number];
export const LENGTH = 5;
export const TRIES = 6;

/** Each language's answers for practice and the daily bank (common words, base forms). */
export const ANSWERS: Readonly<Record<Pack, readonly string[]>> = {
  en: en.answers,
  bg: bg.answers,
};

export interface Daily {
  /** The UTC day, YYYY-MM-DD. */
  day: string;
  word: string;
}

export interface Config {
  pack: Pack;
  /** Set for the day's word; practice otherwise. */
  daily?: Daily;
}

/** A word of LENGTH letters in a language, folded; otherwise null. */
export function answerWord(pack: Pack, raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const word = wordOf(pack, raw);
  return word !== null && charsOf(word).length === LENGTH ? word : null;
}

export const configFrom = (raw: unknown): Config => {
  const r = raw as { pack?: unknown; daily?: unknown } | null | undefined;
  const pack = PACKS.find((p) => p === r?.pack) ?? "en";
  const d = r?.daily as { day?: unknown; word?: unknown } | null | undefined;
  const word = answerWord(pack, d?.word);
  const day = typeof d?.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.day) ? d.day : null;
  return word && day ? { pack, daily: { day, word } } : { pack };
};

/** A letter's mark: in the right place, elsewhere in the word, or not in it. */
export type Mark = "good" | "near" | "miss";

/** Marks a guess against the answer (both folded, LENGTH letters). */
export function marksFor(guess: string, answer: string): Mark[] {
  const g = charsOf(guess);
  const a = charsOf(answer);
  const marks: Mark[] = g.map((ch, i) => (ch === a[i] ? "good" : "miss"));
  const left = new Map<string, number>();
  a.forEach((ch, i) => {
    if (marks[i] !== "good") left.set(ch, (left.get(ch) ?? 0) + 1);
  });
  g.forEach((ch, i) => {
    const n = left.get(ch) ?? 0;
    if (marks[i] === "miss" && n > 0) {
      marks[i] = "near";
      left.set(ch, n - 1);
    }
  });
  return marks;
}

export interface Action {
  guess: string;
}

export interface State {
  pack: Pack;
  /** The day, for the daily game; null in practice. */
  day: string | null;
  answer: string;
  guesses: string[];
  marks: Mark[][];
  won: boolean;
  over: boolean;
}

export function initialState(raw: Config, seed: string): State {
  const config = configFrom(raw);
  const { pack } = config;
  const answer =
    config.daily?.word ?? Rng.fromSeed(`word-of-the-day:${pack}:${seed}`).pick(ANSWERS[pack]);
  return {
    pack,
    day: config.daily?.day ?? null,
    answer,
    guesses: [],
    marks: [],
    won: false,
    over: false,
  };
}

/** Why a guess isn't taken, or null when it is. */
export type Refusal = "length" | "unknown" | "repeat";

export function refusal(s: State, raw: string): Refusal | null {
  const word = answerWord(s.pack, raw);
  if (word === null) return "length";
  if (s.guesses.includes(word)) return "repeat";
  if (word !== s.answer && !lexiconOf(s.pack, "all").has(word)) return "unknown";
  return null;
}

function apply(s: State, action: Action): State {
  const raw = (action as { guess?: unknown } | null)?.guess;
  if (s.over || typeof raw !== "string" || refusal(s, raw) !== null) return s;
  const guess = answerWord(s.pack, raw) ?? "";
  const won = guess === s.answer;
  const guesses = [...s.guesses, guess];
  return {
    ...s,
    guesses,
    marks: [...s.marks, marksFor(guess, s.answer)],
    won,
    over: won || guesses.length === TRIES,
  };
}

/** 7 less the guesses for a solve; 0 for six misses. */
export const scoreOf = (s: State): number => (s.won ? TRIES + 1 - s.guesses.length : 0);

function result(s: State): GameResult | null {
  return s.over ? { completed: s.won, score: scoreOf(s) } : null;
}

export const engine: RaceEngine<State, Action, Config> = {
  initialState,
  apply,
  progress: (s) => (s.over ? 1 : s.guesses.length / TRIES),
  result,
  score: scoreOf,
};
