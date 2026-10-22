// Puzzle generator: a random full grid, then cells removed one by one in a
// random order, keeping only removals that leave exactly one solution (and,
// for the easier levels, that keep the grade in range). Deterministic for a
// seed and difficulty, so race mode and replays get the same puzzle.
import { Rng, seedRng } from "@kefche/game-sdk";

import { CELLS } from "./board";
import { grade, LEVEL, type Level } from "./grader";
import { countSolutions, randomFullGrid } from "./solver";

export const DIFFICULTIES = ["easy", "medium", "hard", "expert"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface Puzzle {
  difficulty: Difficulty;
  /** 81 cells, 0 = empty. */
  givens: number[];
  solution: number[];
}

interface Target {
  /** Grade range a finished puzzle must fall in. */
  minLevel: Level;
  maxLevel: Level;
  /** Stop removing at this many givens. */
  floor: number;
  /** Reject a puzzle with more givens than this. */
  ceiling: number;
}

const TARGETS: Record<Difficulty, Target> = {
  easy: { minLevel: LEVEL.singles, maxLevel: LEVEL.singles, floor: 38, ceiling: 44 },
  medium: { minLevel: LEVEL.singles, maxLevel: LEVEL.singles, floor: 28, ceiling: 34 },
  hard: { minLevel: LEVEL.locked, maxLevel: LEVEL.subsets, floor: 22, ceiling: 32 },
  expert: { minLevel: LEVEL.fish, maxLevel: LEVEL.beyond, floor: 17, ceiling: 30 },
};

const MAX_ATTEMPTS = 500;

export function generate(seed: string, difficulty: Difficulty): Puzzle {
  const target = TARGETS[difficulty];
  const rng = new Rng(seedRng(`sudoku:${difficulty}:${seed}`));
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const solution = randomFullGrid(rng);
    const givens = [...solution];
    let filled = CELLS;
    for (const cell of rng.shuffle(Array.from({ length: CELLS }, (_, i) => i))) {
      if (filled <= target.floor) break;
      const digit = givens[cell] ?? 0;
      givens[cell] = 0;
      // Grading every removal costs time; the expert level skips it and
      // grades once at the end.
      const ok =
        countSolutions(givens) === 1 &&
        (target.maxLevel === LEVEL.beyond || grade(givens) <= target.maxLevel);
      if (ok) filled--;
      else givens[cell] = digit;
    }
    const level = grade(givens);
    if (filled <= target.ceiling && level >= target.minLevel && level <= target.maxLevel) {
      return { difficulty, givens, solution };
    }
  }
  throw new Error(`No ${difficulty} puzzle after ${String(MAX_ATTEMPTS)} attempts`);
}
