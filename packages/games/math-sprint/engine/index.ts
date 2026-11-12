// Math Sprint rules (SPEC §20.8 #80): mental arithmetic against the clock.
// Sixty seconds of problems; type each answer. A right answer scores a
// point; a wrong one scores nothing and the next problem comes. Three
// levels, each with its own board:
//   easy    adding and taking away, to 20
//   medium  adding and taking away to 100, and the times tables to 12
//   hard    two-digit times one-digit, dividing exactly, and mixed sums
// No answer is negative or a fraction. The score is the right answers.
//
// - The problems come from the seed (a race's are everyone's).
// - Each answer says when it came (ms after the first problem appeared,
//   as the player's device measured it); the first within 100 ms of the
//   problem, any within 100 ms of the last (no one reads, works out and
//   types an answer faster), and any after the 60 s don't count.
// - The run ends with a stop at 60 s; every action returns the time since
//   the last from `actionMs`.
// Pure and deterministic.
import { HUMAN, measuredMs, Rng, type GameResult, type RaceEngine } from "@kefche/game-sdk";

export const LEVELS = ["easy", "medium", "hard"] as const;
export type Level = (typeof LEVELS)[number];
export const DURATION_MS = 60_000;
export const PROBLEMS = 400;

export interface Config {
  level: Level;
}

export const configFrom = (raw: unknown): Config => {
  const level = (raw as { level?: unknown } | null | undefined)?.level;
  return { level: LEVELS.find((l) => l === level) ?? "easy" };
};

export type Op = "+" | "-" | "×" | "÷";

export interface Problem {
  a: number;
  op: Op;
  b: number;
  answer: number;
}

export type Action = { answer: number; ms: number } | { stop: true };

export interface State {
  level: Level;
  problems: Problem[];
  /** The problem showing now. */
  index: number;
  last: number;
  right: number;
  wrong: number;
  /** Each answer, and whether it was right (for the summary). */
  answers: { given: number; right: boolean }[];
  over: boolean;
}

const make = (a: number, op: Op, b: number): Problem => ({
  a,
  op,
  b,
  answer: op === "+" ? a + b : op === "-" ? a - b : op === "×" ? a * b : a / b,
});

/** One problem at a level. */
function problem(rng: Rng, level: Level): Problem {
  if (level === "easy") {
    if (rng.next() < 0.5) {
      const a = rng.int(1, 10);
      return make(a, "+", rng.int(1, 10));
    }
    const a = rng.int(2, 20);
    return make(a, "-", rng.int(1, a));
  }
  if (level === "medium") {
    const kind = rng.int(0, 2);
    if (kind === 0) return make(rng.int(10, 60), "+", rng.int(5, 40));
    if (kind === 1) {
      const a = rng.int(20, 100);
      return make(a, "-", rng.int(5, a));
    }
    return make(rng.int(2, 12), "×", rng.int(2, 12));
  }
  const kind = rng.int(0, 2);
  if (kind === 0) return make(rng.int(12, 99), "×", rng.int(3, 9));
  if (kind === 1) {
    const b = rng.int(3, 12);
    return make(b * rng.int(4, 25), "÷", b);
  }
  return make(rng.int(100, 500), rng.next() < 0.5 ? "+" : "-", rng.int(25, 99));
}

export function initialState(config: Config, seed: string): State {
  const level = configFrom(config).level;
  const rng = Rng.fromSeed(`math-sprint:${level}:${seed}`);
  return {
    level,
    problems: Array.from({ length: PROBLEMS }, () => problem(rng, level)),
    index: 0,
    last: 0,
    right: 0,
    wrong: 0,
    answers: [],
    over: false,
  };
}

type Read = { answer: number; ms: number } | { stop: true };

/** What an action is, checked as it arrived (a replayed log can hold anything). */
function read(s: State, action: unknown): Read | null {
  if (s.over || s.index >= PROBLEMS || typeof action !== "object" || action === null) return null;
  if ("stop" in action) return (action as { stop?: unknown }).stop === true ? { stop: true } : null;
  const a = action as { answer?: unknown; ms?: unknown };
  const answer = measuredMs(a.answer, 99_999);
  const ms = measuredMs(a.ms, DURATION_MS - 1);
  if (answer === null || ms === null || ms - s.last < HUMAN.reactionMs) return null;
  return { answer, ms };
}

function apply(s: State, action: Action): State {
  const r = read(s, action);
  if (!r) return s;
  if ("stop" in r) return { ...s, last: DURATION_MS, over: true };
  const right = r.answer === s.problems[s.index]?.answer;
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
  // No winning here, only a score (like Snake and 2048).
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
