// Trivia rules (SPEC §20.6 #54): ten questions, each with four answers and
// 15 seconds. A right answer scores its level's points (100 easy, 150
// medium, 200 hard), half of them for being right and the other half
// shrinking with the time taken; a wrong answer, or none in time, scores
// nothing. The score is the points.
//
// - Questions come from the language's bank (eight categories, three
//   levels, written for kefche, the same questions in every language): three
//   easy, four medium and three hard, easiest first, from all categories or
//   one. The seed picks them and orders each one's answers, so a race's
//   questions are everyone's.
// - Each answer says how long it took (ms from the frame that drew the
//   question, as the player's device measured it). Under 500 ms doesn't
//   count (nobody reads a question and four answers faster), nor does
//   anything past the limit, which is a `timeout` instead.
// Pure and deterministic.
import { measuredMs, Rng, type GameResult, type RaceEngine } from "@kefche/game-sdk";

import bg from "../content/bg.json";
import en from "../content/en.json";

export const PACKS = ["en", "bg"] as const;
export type Pack = (typeof PACKS)[number];
export const CATEGORIES = [
  "geography",
  "history",
  "science",
  "nature",
  "sport",
  "arts",
  "music",
  "food",
] as const;
export type Category = (typeof CATEGORIES)[number];
export const TOPICS = ["mixed", ...CATEGORIES] as const;
export type Topic = (typeof TOPICS)[number];

export interface Config {
  pack: Pack;
  topic: Topic;
}

export const configFrom = (raw: unknown): Config => {
  const r = raw as { pack?: unknown; topic?: unknown } | null | undefined;
  return {
    pack: PACKS.find((p) => p === r?.pack) ?? "en",
    topic: TOPICS.find((t) => t === r?.topic) ?? "mixed",
  };
};

export interface Question {
  id: number;
  category: string;
  level: number;
  question: string;
  /** The right answer first, then three wrong ones. */
  answers: string[];
}

export const BANK: Readonly<Record<Pack, readonly Question[]>> = {
  en: en.questions,
  bg: bg.questions,
};

export const QUESTIONS = 10;
/** Easy, medium and hard questions in a game. */
export const PER_LEVEL = [3, 4, 3] as const;
export const LIMIT_MS = 15_000;
export const MIN_MS = 500;
/** A right answer's points by level (1 to 3); half for being right, half for speed. */
export const LEVEL_POINTS = [0, 100, 150, 200] as const;

/** The points for a right answer at `level` that took `ms`. */
export function pointsFor(level: number, ms: number): number {
  const base = LEVEL_POINTS[level] ?? 100;
  const left = Math.max(0, LIMIT_MS - ms) / LIMIT_MS;
  return base / 2 + Math.round((base / 2) * left);
}

export type Action = { choice: number; ms: number } | { timeout: true };

export interface Answer {
  /** The answer chosen, as shown (0–3), or null when time ran out. */
  choice: number | null;
  ms: number;
  right: boolean;
  points: number;
}

export interface State {
  pack: Pack;
  topic: Topic;
  /** The questions, as indexes into the pack's bank. */
  picks: number[];
  /** For each question, the order its answers are shown in (0 is the right one). */
  orders: number[][];
  index: number;
  answers: Answer[];
  score: number;
  over: boolean;
}

export function initialState(raw: Config, seed: string): State {
  const { pack, topic } = configFrom(raw);
  const rng = Rng.fromSeed(`trivia:${pack}:${topic}:${seed}`);
  const bank = BANK[pack];
  const picks: number[] = [];
  PER_LEVEL.forEach((count, i) => {
    const pool = bank.flatMap((q, k) =>
      q.level === i + 1 && (topic === "mixed" || q.category === topic) ? [k] : [],
    );
    picks.push(...rng.shuffle(pool).slice(0, count));
  });
  return {
    pack,
    topic,
    picks,
    orders: picks.map(() => rng.shuffle([0, 1, 2, 3])),
    index: 0,
    answers: [],
    score: 0,
    over: picks.length === 0,
  };
}

/** The question showing, with its answers in their order. */
export function current(s: State): { question: Question; answers: string[] } | null {
  const question = BANK[s.pack][s.picks[s.index] ?? -1];
  const order = s.orders[s.index];
  if (!question || !order) return null;
  return { question, answers: order.map((k) => question.answers[k] ?? "") };
}

type Read = { choice: number; ms: number } | { timeout: true };

/** What an action is, checked as it arrived (a replayed log can hold anything). */
function read(s: State, action: unknown): Read | null {
  if (s.over || typeof action !== "object" || action === null) return null;
  if ("timeout" in action) {
    return (action as { timeout?: unknown }).timeout === true ? { timeout: true } : null;
  }
  const a = action as { choice?: unknown; ms?: unknown };
  const choice =
    typeof a.choice === "number" && Number.isInteger(a.choice) && a.choice >= 0 && a.choice <= 3
      ? a.choice
      : null;
  const ms = measuredMs(a.ms, LIMIT_MS - 1);
  if (choice === null || ms === null || ms < MIN_MS) return null;
  return { choice, ms };
}

function apply(s: State, action: Action): State {
  const r = read(s, action);
  if (!r) return s;
  const level = BANK[s.pack][s.picks[s.index] ?? -1]?.level ?? 1;
  const answer: Answer =
    "timeout" in r
      ? { choice: null, ms: LIMIT_MS, right: false, points: 0 }
      : (() => {
          const right = s.orders[s.index]?.[r.choice] === 0;
          return { choice: r.choice, ms: r.ms, right, points: right ? pointsFor(level, r.ms) : 0 };
        })();
  const index = s.index + 1;
  return {
    ...s,
    index,
    answers: [...s.answers, answer],
    score: s.score + answer.points,
    over: index >= s.picks.length,
  };
}

function result(s: State): GameResult | null {
  return s.over ? { completed: true, score: s.score } : null;
}

export const engine: RaceEngine<State, Action, Config> = {
  initialState,
  apply,
  progress: (s) => (s.picks.length === 0 ? 1 : s.index / s.picks.length),
  result,
  score: (s) => s.score,
  actionMs: (s, action) => {
    const r = read(s, action);
    if (!r) return 0;
    return "timeout" in r ? LIMIT_MS : r.ms;
  },
};
