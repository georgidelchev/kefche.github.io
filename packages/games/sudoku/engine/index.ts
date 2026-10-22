// Sudoku rules (SPEC §20.3 #21): fill the grid so every row, column and box
// holds 1–9 once. Pure and deterministic: the puzzle comes from the seed and
// the difficulty, and time is measured by the renderer.
import type { GameResult, RaceEngine } from "@kefche/game-sdk";

import { CELLS, PEERS } from "./board";
import { DIFFICULTIES, generate, type Difficulty, type Puzzle } from "./generator";
import { nextSingle } from "./grader";

export { CELLS, boxOf, colOf, rowOf } from "./board";
export { DIFFICULTIES, generate, type Difficulty, type Puzzle } from "./generator";

interface Snapshot {
  values: number[];
  notes: number[];
}

export interface State extends Snapshot {
  difficulty: Difficulty;
  /** 81 cells, 0 = empty. */
  givens: number[];
  solution: number[];
  /** Pencil marks per cell: bits 1–9. */
  notes: number[];
  /** Cells filled by a hint. */
  hinted: number[];
  /** Digits entered that don't match the solution. */
  mistakes: number;
  hints: number;
  moves: number;
  /** Boards before recent actions, for undo. Not saved with the game. */
  history: Snapshot[];
}

export type Action =
  /** Places a digit; the same digit again clears the cell. */
  | { type: "enter"; cell: number; digit: number }
  /** Toggles a pencil mark. */
  | { type: "note"; cell: number; digit: number }
  | { type: "erase"; cell: number }
  /** Fills `cell` if it is empty or wrong, otherwise a cell logic can reach next. */
  | { type: "hint"; cell?: number }
  | { type: "undo" };

export interface Config {
  difficulty: Difficulty;
}

const HISTORY_LIMIT = 100;

export function fromPuzzle(puzzle: Puzzle): State {
  return {
    difficulty: puzzle.difficulty,
    givens: puzzle.givens,
    solution: puzzle.solution,
    values: [...puzzle.givens],
    notes: new Array<number>(CELLS).fill(0),
    hinted: [],
    mistakes: 0,
    hints: 0,
    moves: 0,
    history: [],
  };
}

export const isSolved = (state: State) => state.values.every((v, c) => v === state.solution[c]);

/** Cells whose digit repeats in their row, column or box. */
export function conflicts(values: readonly number[]): Set<number> {
  const out = new Set<number>();
  values.forEach((v, c) => {
    if (v && (PEERS[c] ?? []).some((p) => values[p] === v)) out.add(c);
  });
  return out;
}

const inBoard = (cell: number) => Number.isInteger(cell) && cell >= 0 && cell < CELLS;
const isDigit = (digit: number) => Number.isInteger(digit) && digit >= 1 && digit <= 9;

/** Puts a digit in a cell and clears that digit from the notes it now rules out. */
function place(state: State, cell: number, digit: number): Snapshot {
  const values = [...state.values];
  const notes = [...state.notes];
  values[cell] = digit;
  notes[cell] = 0;
  if (digit) for (const p of PEERS[cell] ?? []) notes[p] = (notes[p] ?? 0) & ~(1 << digit);
  return { values, notes };
}

function commit(state: State, next: Snapshot, extra: Partial<State> = {}): State {
  return {
    ...state,
    ...next,
    ...extra,
    moves: state.moves + 1,
    history: [
      ...state.history.slice(-(HISTORY_LIMIT - 1)),
      { values: state.values, notes: state.notes },
    ],
  };
}

export const engine: RaceEngine<State, Action, Config> = {
  initialState(config, seed) {
    return fromPuzzle(generate(seed, config.difficulty));
  },

  apply(state, action) {
    if (action.type === "undo") {
      const previous = state.history.at(-1);
      if (!previous) return state;
      return { ...state, ...previous, moves: state.moves + 1, history: state.history.slice(0, -1) };
    }
    if (isSolved(state)) return state;

    if (action.type === "hint") {
      const correct = state.values.map((v, c) => (v === state.solution[c] ? v : 0));
      const chosen =
        action.cell !== undefined &&
        inBoard(action.cell) &&
        state.values[action.cell] !== state.solution[action.cell]
          ? action.cell
          : (nextSingle(correct)?.cell ?? correct.indexOf(0));
      const digit = state.solution[chosen];
      if (chosen < 0 || digit === undefined) return state;
      return commit(state, place(state, chosen, digit), {
        hinted: [...state.hinted, chosen],
        hints: state.hints + 1,
      });
    }

    if (!inBoard(action.cell) || state.givens[action.cell]) return state;
    const current = state.values[action.cell] ?? 0;

    if (action.type === "erase") {
      if (!current && !state.notes[action.cell]) return state;
      const values = [...state.values];
      const notes = [...state.notes];
      values[action.cell] = 0;
      notes[action.cell] = 0;
      return commit(state, { values, notes });
    }

    if (!isDigit(action.digit)) return state;

    if (action.type === "note") {
      if (current) return state;
      const notes = [...state.notes];
      notes[action.cell] = (notes[action.cell] ?? 0) ^ (1 << action.digit);
      return commit(state, { values: state.values, notes });
    }

    if (current === action.digit) return commit(state, place(state, action.cell, 0));
    const wrong = action.digit !== state.solution[action.cell];
    return commit(state, place(state, action.cell, action.digit), {
      mistakes: state.mistakes + (wrong ? 1 : 0),
    });
  },

  progress(state) {
    const open = state.givens.filter((v) => !v).length;
    const done = state.values.filter((v, c) => !state.givens[c] && v === state.solution[c]).length;
    return open ? done / open : 1;
  },

  result(state): GameResult | null {
    return isSolved(state) ? { completed: true } : null;
  },
};

/** A saved game read back from storage, or null when it doesn't look right. */
export function restore(data: unknown): State | null {
  if (typeof data !== "object" || data === null) return null;
  const s = data as Record<string, unknown>;
  const isCount = (v: unknown): v is number =>
    typeof v === "number" && Number.isInteger(v) && v >= 0;
  const isGrid = (v: unknown, max: number): v is number[] =>
    Array.isArray(v) && v.length === CELLS && (v as unknown[]).every((x) => isCount(x) && x <= max);
  const { difficulty, givens, solution, values, notes, hinted, mistakes, hints, moves } = s;
  if (
    !DIFFICULTIES.some((d) => d === difficulty) ||
    !isGrid(givens, 9) ||
    !isGrid(solution, 9) ||
    !isGrid(values, 9) ||
    !isGrid(notes, 0b1111111110) ||
    !Array.isArray(hinted) ||
    !(hinted as unknown[]).every((c) => isCount(c) && inBoard(c)) ||
    !isCount(mistakes) ||
    !isCount(hints) ||
    !isCount(moves)
  ) {
    return null;
  }
  // The givens belong to the solution and are still on the board.
  if (givens.some((v, c) => v && (v !== solution[c] || values[c] !== v))) return null;
  return {
    difficulty: difficulty as Difficulty,
    givens,
    solution,
    values,
    notes,
    hinted: hinted as number[],
    mistakes,
    hints,
    moves,
    history: [],
  };
}

/** What to keep in storage: the game without its undo history. */
export const toSaved = (state: State) => ({ ...state, history: [] });
