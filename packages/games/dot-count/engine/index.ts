// Dot Count rules (SPEC §20.8 #78): ten rounds. Each round a field of dots
// flashes for 1.2 seconds, then hides; say how many there were. The early
// rounds can be counted (5 to 12 dots), the later ones only estimated (up
// to 40). An exact answer scores 100; otherwise the points fall with how
// far off it was, to nothing at half the count away. The score is the
// points over the ten rounds, higher being better.
//
// - The counts and the dots' places come from the seed (a race's rounds
//   are everyone's), spread so no two dots touch.
// - Each answer returns the round's showing time from `actionMs`, so the
//   server refuses a log claiming ten rounds sooner than they could be
//   shown.
// Pure and deterministic.
import { measuredMs, Rng, type GameResult, type RaceEngine } from "@kefche/game-sdk";

export const ROUNDS = 10;
export const SHOW_MS = 1200;
export const FIELD = 1000;
export const DOT_RADIUS = 22;
export const MAX_POINTS = 100;
/** The fewest and most dots in each round, rising. */
const RANGES: readonly (readonly [number, number])[] = [
  [5, 8],
  [6, 10],
  [8, 12],
  [10, 15],
  [12, 18],
  [15, 22],
  [18, 26],
  [20, 30],
  [24, 35],
  [28, 40],
];

export interface Action {
  guess: number;
}

export interface Round {
  dots: [number, number][];
}

export interface State {
  rounds: Round[];
  /** Each answered round's guess and points. */
  answers: { guess: number; points: number }[];
}

function field(rng: Rng, count: number): [number, number][] {
  const dots: [number, number][] = [];
  const min = DOT_RADIUS * 2.6;
  let tries = 0;
  while (dots.length < count && tries < 20_000) {
    tries++;
    const x = rng.int(DOT_RADIUS * 2, FIELD - DOT_RADIUS * 2);
    const y = rng.int(DOT_RADIUS * 2, FIELD - DOT_RADIUS * 2);
    if (dots.every(([a, b]) => Math.hypot(a - x, b - y) >= min)) dots.push([x, y]);
  }
  return dots;
}

export function initialState(_config: undefined, seed: string): State {
  const rng = Rng.fromSeed(`dot-count:${seed}`);
  const rounds = RANGES.map(([lo, hi]) => ({ dots: field(rng, rng.int(lo, hi)) }));
  return { rounds, answers: [] };
}

export const isOver = (s: State): boolean => s.answers.length >= ROUNDS;

/** Points for a guess when there were `actual` dots. */
export function pointsFor(guess: number, actual: number): number {
  if (guess === actual) return MAX_POINTS;
  const off = Math.abs(guess - actual) / (actual / 2);
  return Math.max(0, Math.round(MAX_POINTS * 0.9 * (1 - off)));
}

function read(s: State, action: unknown): number | null {
  if (isOver(s) || typeof action !== "object" || action === null) return null;
  return measuredMs((action as { guess?: unknown }).guess, 999);
}

function apply(s: State, action: Action): State {
  const guess = read(s, action);
  if (guess === null) return s;
  const actual = s.rounds[s.answers.length]?.dots.length ?? 0;
  return { ...s, answers: [...s.answers, { guess, points: pointsFor(guess, actual) }] };
}

export const score = (s: State): number => s.answers.reduce((n, a) => n + a.points, 0);

function result(s: State): GameResult | null {
  // No winning here, only a score (like Snake and 2048).
  return isOver(s) ? { completed: false, score: score(s) } : null;
}

export const engine: RaceEngine<State, Action> = {
  initialState,
  apply,
  progress: (s) => s.answers.length / ROUNDS,
  result,
  score,
  // Each answer follows its round's showing.
  actionMs: (s, action) => (read(s, action) === null ? 0 : SHOW_MS),
};
