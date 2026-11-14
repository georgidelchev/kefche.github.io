// Categories bots (SPEC §9.5). They answer from the language's packs of
// known answers, so their own answers always count, and see only what their
// seat may: no other sheet until all are in.
// - Answering: easy fills about half the categories, mostly with the first,
//   most common answers (which others give too, for 5); medium fills most;
//   hard nearly all, preferring answers further down the list, which are
//   less often shared and so worth 10.
// - Voting: easy lets everything in. Medium and hard let an answer in when
//   it's a known answer misspelt by a letter or two, a word of the
//   dictionary for a category of things (an animal, a plant, food, a job, a
//   thing), or a plausible name for a city or a person; never an unknown
//   country, since the packs hold every country.
import { charsOf, lexiconOf, type Bot, type GameBots, type Rng } from "@kefche/game-sdk";

import { answerKey, CATEGORIES, HIDDEN, KNOWN, type Action, type State } from "../engine";

interface Level {
  /** The chance of answering each category. */
  fill: number;
  /** Where in a letter's list to pick from: 0 the start, 1 anywhere. */
  reach: number;
  /** Whether to vote with thought, or let everything in. */
  judge: boolean;
}

/** Edit distance between two strings, giving up above `limit`. */
export function distance(a: string, b: string, limit: number): number {
  const x = charsOf(a);
  const y = charsOf(b);
  if (Math.abs(x.length - y.length) > limit) return limit + 1;
  let previous = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      const v = Math.min(
        (previous[j] ?? 0) + 1,
        (row[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
      row.push(v);
      best = Math.min(best, v);
    }
    if (best > limit) return limit + 1;
    previous = row;
  }
  return previous[y.length] ?? limit + 1;
}

const THINGS = new Set(["animal", "plant", "food", "job", "thing"]);
const VOWELS = /[aeiouyаеиоуъюя]/u;

/** Whether a medium or hard bot lets a doubtful answer in. */
export function plausible(s: State, slot: number, answer: string): boolean {
  const category = s.categories[slot] ?? 0;
  const id = CATEGORIES[category] ?? "";
  const key = answerKey(answer);
  const letters = charsOf(key).length;
  if (letters < 2 || /(.)\1\1/u.test(key) || !VOWELS.test(key)) return false;
  // A known answer, misspelt.
  const limit = letters >= 8 ? 2 : letters >= 4 ? 1 : 0;
  const { keys } = KNOWN[s.config.pack];
  for (const k of keys[category] ?? []) if (distance(key, k, limit) <= limit) return true;
  if (id === "country") return false;
  if (THINGS.has(id)) {
    const words = lexiconOf(s.config.pack, "all");
    return answer.split(" ").every((w) => words.has(w));
  }
  // A city or a person's name: anything that looks like one.
  return letters >= 3;
}

function answer(s: State, level: Level, rng: Rng): string[] {
  const letter = s.letters[s.round] ?? HIDDEN;
  const { byLetter } = KNOWN[s.config.pack];
  return s.categories.map((category) => {
    const list = byLetter[category]?.get(letter) ?? [];
    if (list.length === 0 || rng.next() >= level.fill) return "";
    const top = Math.max(1, Math.ceil(list.length * level.reach));
    // Hard reaches past the first answers, which everyone thinks of.
    const from = level.reach >= 1 && list.length > 3 ? 1 : 0;
    return list[from + Math.floor(rng.next() * Math.max(1, top - from))] ?? list[0] ?? "";
  });
}

function vote(s: State, seat: number, level: Level): boolean[] {
  return s.doubts.map((d) => {
    if (d.seat === seat || !level.judge) return true;
    return plausible(s, d.slot, s.sheets[d.seat]?.[d.slot] ?? "");
  });
}

const bot = (level: Level): Bot<State, Action> => ({
  choose: (s, seat, { rng }) =>
    s.phase === "answer" ? { answers: answer(s, level, rng) } : { votes: vote(s, seat, level) },
});

export const bots: GameBots<State, Action> = {
  easy: bot({ fill: 0.5, reach: 0.35, judge: false }),
  medium: bot({ fill: 0.75, reach: 0.7, judge: true }),
  hard: bot({ fill: 0.92, reach: 1, judge: true }),
};
