// Anagrams rules (SPEC §20.7 #63): seven letters, two minutes. Make as many
// words of three letters or more from them as you can, each letter used at
// most once a word; every set hides a seven-letter word. A word scores by
// its length: 3 letters 1 point, 4 letters 2, 5 letters 4, 6 letters 7, and
// the whole seven 12. The score is the points, higher being better.
//
// - The letters come from the seed (a race's are everyone's): one of the
//   language's seven-letter seed words (content packs), shuffled.
// - A word counts if it's in the language's dictionary (`lexiconOf`,
//   ADR-0050) and not found already. Each says when it came (ms after the
//   letters appeared); one within 100 ms of the last doesn't count, nor any
//   after the two minutes. The run ends with a stop.
// - Every action returns the time since the last from `actionMs`.
// Pure and deterministic.
import {
  canSpell,
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

import bg from "../content/bg.json";
import en from "../content/en.json";

export const PACKS = ["en", "bg"] as const;
export type Pack = (typeof PACKS)[number];

export interface Config {
  pack: Pack;
}

export const configFrom = (raw: unknown): Config => {
  const pack = (raw as { pack?: unknown } | null | undefined)?.pack;
  return { pack: PACKS.find((p) => p === pack) ?? "en" };
};

export const DURATION_MS = 120_000;
export const MIN_LENGTH = 3;
export const LETTERS = 7;
/** Points by a word's length. */
export const POINTS: Readonly<Record<number, number>> = { 3: 1, 4: 2, 5: 4, 6: 7, 7: 12 };

const SEEDS: Readonly<Record<Pack, readonly string[]>> = { en: en.seeds, bg: bg.seeds };

export type Action = { word: string; ms: number } | { stop: true };

export interface State {
  pack: Pack;
  /** The seven-letter word the letters come from (shown at the end). */
  seed: string;
  letters: string[];
  /** Words found, in order. */
  found: string[];
  points: number;
  last: number;
  over: boolean;
}

export function initialState(raw: Config, seed: string): State {
  const { pack } = configFrom(raw);
  const rng = Rng.fromSeed(`anagrams:${pack}:${seed}`);
  const word = rng.pick(SEEDS[pack]);
  return {
    pack,
    seed: word,
    letters: rng.shuffle(charsOf(word)),
    found: [],
    points: 0,
    last: 0,
    over: false,
  };
}

/** Why a word would or wouldn't count. */
export type Verdict = "ok" | "short" | "letters" | "found" | "unknown";

export function judge(s: State, raw: string): Verdict {
  const word = wordOf(s.pack, raw);
  if (word === null || charsOf(word).length < MIN_LENGTH) return "short";
  if (!canSpell(word, s.letters.join(""))) return "letters";
  if (s.found.includes(word)) return "found";
  return lexiconOf(s.pack, "all").has(word) ? "ok" : "unknown";
}

export const pointsFor = (word: string): number => POINTS[charsOf(word).length] ?? 0;

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

/** Every word of three letters or more the letters make, in a list (the end's "you could have made"). */
export function allWords(lexicon: Lexicon, letters: readonly string[]): string[] {
  const out = new Set<string>();
  const walk = (node: LexiconNode, left: readonly string[], sofar: string) => {
    for (const edge of lexicon.next(node)) {
      const i = left.indexOf(edge.letter);
      if (i < 0) continue;
      const word = sofar + edge.letter;
      if (edge.word && charsOf(word).length >= MIN_LENGTH) out.add(word);
      walk(edge.node, [...left.slice(0, i), ...left.slice(i + 1)], word);
    }
  };
  walk(lexicon.root, letters, "");
  return [...out].sort((a, b) => charsOf(b).length - charsOf(a).length || (a < b ? -1 : 1));
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
