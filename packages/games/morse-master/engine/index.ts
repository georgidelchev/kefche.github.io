// Morse Master rules (SPEC §20.7 #70): a minute of Morse code, letter by
// letter. Two tasks, in English (International Morse, ITU-R M.1677) or
// Bulgarian (the Cyrillic table, where Ъ and Ь differ from Russian):
//   read  a letter's code is shown and played; answer with the letter
//   send  a letter is shown; key its code in dots and dashes
// A right answer scores a point; a wrong one scores nothing, shows the
// right answer, and the next answer counts only a second later (so
// guessing at random scores almost nothing). The score is the right answers.
//
// - The letters come from the seed (a race's are everyone's), never the
//   same letter twice running.
// - Each answer says when it came (ms after the first letter appeared, as
//   the player's device measured it). One within 100 ms of the last, a
//   code keyed faster than 50 ms a symbol, one within a second of a wrong
//   answer, and any after the 60 s don't count.
// - The run ends with a stop at 60 s; every action returns the time since
//   the last from `actionMs`.
// Pure and deterministic.
import {
  ALPHABETS,
  charsOf,
  HUMAN,
  measuredMs,
  Rng,
  type GameResult,
  type RaceEngine,
} from "@kefche/game-sdk";

export const PACKS = ["en", "bg"] as const;
export type Pack = (typeof PACKS)[number];
export const TASKS = ["read", "send"] as const;
export type Task = (typeof TASKS)[number];

export interface Config {
  pack: Pack;
  task: Task;
}

export const configFrom = (raw: unknown): Config => {
  const r = raw as { pack?: unknown; task?: unknown } | null | undefined;
  return {
    pack: PACKS.find((p) => p === r?.pack) ?? "en",
    task: r?.task === "send" ? "send" : "read",
  };
};

/**
 * Each language's letters and their codes ("." a dot, "-" a dash). English:
 * ITU-R M.1677-1. Bulgarian: the Cyrillic table as Bulgarian uses it (the
 * Russian one, with Ъ on X's code and Ь on Y's), checked against
 * bg.wikipedia.org's "Морзова азбука" and en.wikipedia.org's "Morse code
 * for non-Latin alphabets".
 */
export const CODES: Readonly<Record<Pack, Readonly<Record<string, string>>>> = {
  en: {
    a: ".-",
    b: "-...",
    c: "-.-.",
    d: "-..",
    e: ".",
    f: "..-.",
    g: "--.",
    h: "....",
    i: "..",
    j: ".---",
    k: "-.-",
    l: ".-..",
    m: "--",
    n: "-.",
    o: "---",
    p: ".--.",
    q: "--.-",
    r: ".-.",
    s: "...",
    t: "-",
    u: "..-",
    v: "...-",
    w: ".--",
    x: "-..-",
    y: "-.--",
    z: "--..",
  },
  bg: {
    а: ".-",
    б: "-...",
    в: ".--",
    г: "--.",
    д: "-..",
    е: ".",
    ж: "...-",
    з: "--..",
    и: "..",
    й: ".---",
    к: "-.-",
    л: ".-..",
    м: "--",
    н: "-.",
    о: "---",
    п: ".--.",
    р: ".-.",
    с: "...",
    т: "-",
    у: "..-",
    ф: "..-.",
    х: "....",
    ц: "-.-.",
    ч: "---.",
    ш: "----",
    щ: "--.-",
    ъ: "-..-",
    ь: "-.--",
    ю: "..--",
    я: ".-.-",
  },
};

/** A pack's letters in alphabetical order. */
export const lettersIn = (pack: Pack): string[] => charsOf(ALPHABETS[pack]);

export const codeOf = (pack: Pack, letter: string): string => CODES[pack][letter] ?? "";

export const DURATION_MS = 60_000;
/** More letters than anyone answers in a minute. */
export const LETTERS = 400;
/** After a wrong answer, the next counts only this much later. */
export const WRONG_PAUSE_MS = 1000;
/** The longest code (Ш is four dashes; none is longer than four). */
const MAX_CODE = 4;

export type Action = { answer: string; ms: number } | { stop: true };

export interface State {
  pack: Pack;
  task: Task;
  letters: string[];
  /** The letter showing now. */
  index: number;
  last: number;
  right: number;
  wrong: number;
  /** Each answer (a letter, or a code), and whether it was right. */
  answers: { given: string; right: boolean }[];
  over: boolean;
}

export function initialState(raw: Config, seed: string): State {
  const { pack, task } = configFrom(raw);
  const rng = Rng.fromSeed(`morse-master:${pack}:${task}:${seed}`);
  const all = lettersIn(pack);
  const letters: string[] = [];
  for (let i = 0; i < LETTERS; i++) {
    const prev = letters[i - 1];
    letters.push(rng.pick(all.filter((l) => l !== prev)));
  }
  return { pack, task, letters, index: 0, last: 0, right: 0, wrong: 0, answers: [], over: false };
}

/** Whether a string is a code a player could key. */
const isCode = (s: string): boolean => s.length >= 1 && s.length <= MAX_CODE && /^[.-]+$/.test(s);

type Read = { answer: string; ms: number } | { stop: true };

/** What an action is, checked as it arrived (a replayed log can hold anything). */
function read(s: State, action: unknown): Read | null {
  if (s.over || s.index >= LETTERS || typeof action !== "object" || action === null) return null;
  if ("stop" in action) return (action as { stop?: unknown }).stop === true ? { stop: true } : null;
  const a = action as { answer?: unknown; ms?: unknown };
  const ms = measuredMs(a.ms, DURATION_MS - 1);
  if (typeof a.answer !== "string" || ms === null) return null;
  const answer = a.answer;
  const valid = s.task === "read" ? codeOf(s.pack, answer) !== "" : isCode(answer);
  if (!valid) return null;
  const lastWrong = s.answers.at(-1)?.right === false;
  const least = Math.max(
    HUMAN.reactionMs,
    s.task === "send" ? answer.length * HUMAN.tapGapMs : 0,
    lastWrong ? WRONG_PAUSE_MS : 0,
  );
  return ms - s.last < least ? null : { answer, ms };
}

/** Whether an answer is right for a letter. */
export const isRight = (s: State, letter: string, answer: string): boolean =>
  s.task === "read" ? answer === letter : answer === codeOf(s.pack, letter);

function apply(s: State, action: Action): State {
  const r = read(s, action);
  if (!r) return s;
  if ("stop" in r) return { ...s, last: DURATION_MS, over: true };
  const right = isRight(s, s.letters[s.index] ?? "", r.answer);
  return {
    ...s,
    index: s.index + 1,
    last: r.ms,
    right: s.right + (right ? 1 : 0),
    wrong: s.wrong + (right ? 0 : 1),
    answers: [...s.answers, { given: r.answer, right }],
  };
}

function result(s: State): GameResult | null {
  // No winning here, only a score (like Math Sprint).
  return s.over ? { completed: false, score: s.right } : null;
}

export const engine: RaceEngine<State, Action, Config> = {
  initialState,
  apply,
  progress: (s) => (s.over ? 1 : s.last / DURATION_MS),
  result,
  score: (s) => s.right,
  actionMs: (s, action) => {
    const r = read(s, action);
    if (!r) return 0;
    return ("stop" in r ? DURATION_MS : r.ms) - s.last;
  },
};
