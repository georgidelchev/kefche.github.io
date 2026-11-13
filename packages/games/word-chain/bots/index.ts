// Word Chain bots (SPEC §9.5). They know the dictionary (their worker loads
// the lists, ADR-0050) and look for a word by walking it at random from the
// letter they must start with, among words people know where the language
// has a list of them.
// - Easy: a short word; one turn in five it can't think of one and passes.
// - Medium: any word; it passes one turn in twenty.
// - Hard: never passes while there's a word, and of the words it thinks
//   of, plays the one ending in the letter fewest words start with.
import {
  charsOf,
  hasLexicon,
  lexiconOf,
  type Bot,
  type GameBots,
  type Lexicon,
  type LexiconNode,
  type Rng,
} from "@kefche/game-sdk";

import { judge, lastLetter, MIN_LENGTH, type Action, type Pack, type State } from "../engine";

/** A word from a node on, found by walking the list at random (null after a few dead ends). */
function randomWord(
  lexicon: Lexicon,
  start: LexiconNode,
  prefix: string,
  rng: Rng,
  maxLength: number,
): string | null {
  for (let attempt = 0; attempt < 40; attempt++) {
    let node = start;
    let word = prefix;
    for (let depth = charsOf(prefix).length; depth < maxLength; depth++) {
      const edges = lexicon.next(node);
      if (edges.length === 0) break;
      const edge = rng.pick(edges);
      word += edge.letter;
      node = edge.node;
      // Stop at a word now and then, more often the longer it is.
      if (edge.word && charsOf(word).length >= MIN_LENGTH && rng.next() < 0.35 + depth * 0.08)
        return word;
    }
  }
  return null;
}

/** How many words start with each letter (counted once a list). */
const starts = new WeakMap<Lexicon, Map<string, number>>();
function startCount(lexicon: Lexicon, letter: string): number {
  let counts = starts.get(lexicon);
  if (!counts) {
    counts = new Map();
    for (const edge of lexicon.next(lexicon.root)) {
      counts.set(edge.letter, lexicon.words({ prefix: edge.letter, limit: 4000 }).length);
    }
    starts.set(lexicon, counts);
  }
  return counts.get(letter) ?? 0;
}

const listFor = (pack: Pack): Lexicon =>
  hasLexicon(pack, "common") ? lexiconOf(pack, "common") : lexiconOf(pack, "all");

function think(s: State, rng: Rng, tries: number, maxLength: number): string[] {
  const lexicon = listFor(s.config.pack);
  const start = lexicon.walk(s.letter);
  if (!start) return [];
  const found = new Set<string>();
  for (let i = 0; i < tries; i++) {
    const word = randomWord(lexicon, start.node, s.letter, rng, maxLength);
    if (word !== null && judge(s, word) === "ok") found.add(word);
  }
  return [...found];
}

const bot = (level: "easy" | "medium" | "hard"): Bot<State, Action> => ({
  choose(s, _seat, { rng }) {
    if (level === "easy" && rng.next() < 0.2) return { pass: true };
    if (level === "medium" && rng.next() < 0.05) return { pass: true };
    const words = think(s, rng, level === "hard" ? 24 : 6, level === "easy" ? 5 : 9);
    if (words.length === 0) return { pass: true };
    if (level !== "hard") return { word: rng.pick(words) };
    const lexicon = listFor(s.config.pack);
    const ranked = [...words].sort(
      (a, b) =>
        startCount(lexicon, lastLetter(s.config.pack, a)) -
        startCount(lexicon, lastLetter(s.config.pack, b)),
    );
    return { word: ranked[0] ?? words[0] ?? "" };
  },
});

export const bots: GameBots<State, Action> = {
  easy: bot("easy"),
  medium: bot("medium"),
  hard: bot("hard"),
};
