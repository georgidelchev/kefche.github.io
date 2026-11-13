// Hangman bots (SPEC §9.5). They see only the view (the guessed letters),
// and know the game's own packs, never the dictionary.
// - Guessing: the pack words that fit what's showing (the same length, the
//   revealed letters in place, no wrong letters) vote for their letters;
//   the bot picks the most-voted. With no fitting word (a versus word from
//   outside the packs) it goes by the language's letter frequencies.
//   Easy guesses at random half the time; medium uses every pack word;
//   hard looks only within the round's theme, where the word is from.
// - Setting a word (versus): easy a short pack word, medium any, hard one
//   of the longest with the rarest letters.
import { charsOf, type Bot, type GameBots, type Rng } from "@kefche/game-sdk";

import { HIDDEN, PACK_WORDS, type Action, type Pack, type State } from "../engine";

/** Letters from most to least common in each language's words. */
const FREQUENCY: Readonly<Record<Pack, string>> = {
  en: "esiarntolcdugpmhbyfvkwzxjq",
  bg: "аоиетнрсвлкдпмзябгучъжйшцщфхьюя",
};

/** Pack words that could be the word showing. */
function fitting(s: State, sameTheme: boolean): string[] {
  const wrong = s.guessed.filter((l) => !s.word.includes(l));
  return PACK_WORDS[s.config.pack]
    .filter((w) => !sameTheme || s.category === null || w.category === s.category)
    .map((w) => charsOf(w.word))
    .filter(
      (w) =>
        w.length === s.word.length &&
        w.every((l, i) => {
          const shown = s.word[i];
          return shown !== undefined && shown !== HIDDEN ? l === shown : !s.guessed.includes(l);
        }) &&
        !w.some((l) => wrong.includes(l)),
    )
    .map((w) => w.join(""));
}

function bestLetter(s: State, sameTheme: boolean, rng: Rng): Action {
  const open = charsOf(FREQUENCY[s.config.pack]).filter((l) => !s.guessed.includes(l));
  const votes = new Map<string, number>();
  for (const word of fitting(s, sameTheme)) {
    for (const l of new Set(charsOf(word)))
      if (open.includes(l)) votes.set(l, (votes.get(l) ?? 0) + 1);
  }
  if (votes.size > 0) {
    const most = Math.max(...votes.values());
    return { letter: rng.pick([...votes].filter(([, n]) => n === most).map(([l]) => l)) };
  }
  return { letter: open[0] ?? "a" };
}

/** How rare a word's letters are (higher: harder to guess). */
function rarity(pack: Pack, word: string): number {
  const order = FREQUENCY[pack];
  const distinct = [...new Set(charsOf(word))];
  return distinct.length === 0
    ? 0
    : distinct.reduce((n, l) => n + order.indexOf(l), 0) / distinct.length;
}

function setWord(s: State, level: "easy" | "medium" | "hard", rng: Rng): Action {
  const words = PACK_WORDS[s.config.pack].map((w) => w.word);
  if (level === "easy") return { set: rng.pick(words.filter((w) => charsOf(w).length <= 6)) };
  if (level === "medium") return { set: rng.pick(words) };
  const ranked = [...words].sort(
    (a, b) =>
      charsOf(b).length +
      rarity(s.config.pack, b) / 4 -
      (charsOf(a).length + rarity(s.config.pack, a) / 4),
  );
  return { set: rng.pick(ranked.slice(0, 12)) };
}

const bot = (level: "easy" | "medium" | "hard"): Bot<State, Action> => ({
  choose(s, _seat, { rng }) {
    if (s.phase === "set") return setWord(s, level, rng);
    if (level === "easy" && rng.next() < 0.5) {
      const open = charsOf(FREQUENCY[s.config.pack]).filter((l) => !s.guessed.includes(l));
      return { letter: rng.pick(open.slice(0, 12).length > 0 ? open.slice(0, 12) : open) };
    }
    return bestLetter(s, level === "hard", rng);
  },
});

export const bots: GameBots<State, Action> = {
  easy: bot("easy"),
  medium: bot("medium"),
  hard: bot("hard"),
};
