// Minesweeper rules (SPEC §20.3 #22): Beginner (9 × 9, 10 mines),
// Intermediate (16 × 16, 40) and Expert (16 × 30, 99, upright to suit a
// phone). Reveal every cell without a mine; a revealed number counts the
// mines around it, and a revealed blank opens its neighbours. Flags mark
// mines; chording a number whose mines are all flagged reveals the rest of
// its neighbours.
//
// The mines are laid on the first reveal, away from that cell and its
// neighbours, from the seed and that cell; a board that logic alone can't
// clear from there is laid again (up to a limit), so boards rarely need a
// guess. A race (and the daily challenge) starts everyone on the same marked
// cell, so everyone gets the same board. Pure and deterministic.
import { Rng, type GameResult, type RaceEngine } from "@kefche/game-sdk";

export const LEVELS = {
  beginner: { cols: 9, rows: 9, mines: 10 },
  intermediate: { cols: 16, rows: 16, mines: 40 },
  expert: { cols: 16, rows: 30, mines: 99 },
} as const;
export type Level = keyof typeof LEVELS;
export const LEVEL_ORDER: readonly Level[] = ["beginner", "intermediate", "expert"];

export interface Config {
  level: Level;
}

export type Action =
  | { type: "reveal"; cell: number }
  | { type: "flag"; cell: number }
  | { type: "chord"; cell: number };

export interface State {
  level: Level;
  cols: number;
  rows: number;
  count: number;
  seed: string;
  /** The marked start (races must begin here). */
  start: number;
  /** 1 for a mine; empty until the first reveal. */
  mines: number[];
  /** 1 revealed. */
  open: number[];
  /** 1 flagged. */
  flags: number[];
  moves: number;
  exploded: number | null;
  won: boolean;
}

export const configFrom = (raw: unknown): Config => {
  const level = (raw as { level?: unknown } | null | undefined)?.level;
  return { level: LEVEL_ORDER.find((l) => l === level) ?? "beginner" };
};

export function around(cell: number, cols: number, rows: number): number[] {
  const r = Math.floor(cell / cols);
  const c = cell % cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push(rr * cols + cc);
    }
  }
  return out;
}

export const countAround = (mines: readonly number[], cell: number, cols: number, rows: number) =>
  around(cell, cols, rows).reduce((n, a) => n + (mines[a] ?? 0), 0);

/** Opens `cell`, flooding through blanks; returns the new open list. */
function flood(
  mines: readonly number[],
  open: number[],
  flags: readonly number[],
  cell: number,
  cols: number,
  rows: number,
): number[] {
  const out = open.slice();
  const stack = [cell];
  while (stack.length > 0) {
    const at = stack.pop() ?? 0;
    if (out[at] || flags[at]) continue;
    out[at] = 1;
    if (mines[at]) continue;
    if (countAround(mines, at, cols, rows) === 0) {
      for (const n of around(at, cols, rows)) if (!out[n]) stack.push(n);
    }
  }
  return out;
}

/** Whether logic alone (single cells, and pairs of neighbouring numbers) clears the board from `first`. */
export function solvable(
  mines: readonly number[],
  first: number,
  cols: number,
  rows: number,
): boolean {
  const n = cols * rows;
  let open = flood(mines, new Array<number>(n).fill(0), [], first, cols, rows);
  const known = new Array<number>(n).fill(0);
  const safeTotal = n - mines.reduce((s, v) => s + v, 0);
  for (let pass = 0; pass < n; pass++) {
    let changed = false;
    const info: { hidden: number[]; left: number }[] = [];
    for (let cell = 0; cell < n; cell++) {
      if (!open[cell] || mines[cell]) continue;
      const hidden = around(cell, cols, rows).filter((a) => !open[a] && !known[a]);
      if (hidden.length === 0) continue;
      const flagged = around(cell, cols, rows).filter((a) => known[a]).length;
      const left = countAround(mines, cell, cols, rows) - flagged;
      if (left === hidden.length) {
        for (const h of hidden) known[h] = 1;
        changed = true;
      } else if (left === 0) {
        for (const h of hidden) open = flood(mines, open, known, h, cols, rows);
        changed = true;
      } else info.push({ hidden, left });
    }
    if (!changed) {
      // Pairs: one number's hidden cells inside another's.
      outer: for (const a of info) {
        for (const b of info) {
          if (a === b || !a.hidden.every((h) => b.hidden.includes(h))) continue;
          const rest = b.hidden.filter((h) => !a.hidden.includes(h));
          if (rest.length === 0) continue;
          if (b.left - a.left === 0) {
            for (const h of rest) open = flood(mines, open, known, h, cols, rows);
            changed = true;
            break outer;
          }
          if (b.left - a.left === rest.length) {
            for (const h of rest) known[h] = 1;
            changed = true;
            break outer;
          }
        }
      }
    }
    if (!changed) break;
  }
  return open.reduce((s, v, i) => s + (v && !mines[i] ? 1 : 0), 0) === safeTotal;
}

const ATTEMPTS = 60;

/** The mines for a first reveal on `first`: clear of it and its neighbours, solvable if found in time. */
export function layMines(seed: string, level: Level, first: number): number[] {
  const { cols, rows, mines: count } = LEVELS[level];
  const n = cols * rows;
  const clear = new Set([first, ...around(first, cols, rows)]);
  const spots = Array.from({ length: n }, (_, i) => i).filter((i) => !clear.has(i));
  let board: number[] = [];
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const rng = Rng.fromSeed(`${seed}:mines:${level}:${String(first)}:${String(attempt)}`);
    const chosen = new Set(rng.shuffle(spots).slice(0, count));
    board = Array.from({ length: n }, (_, i) => (chosen.has(i) ? 1 : 0));
    if (solvable(board, first, cols, rows)) return board;
  }
  return board;
}

const safeLeft = (s: State) => s.open.reduce((n, v, i) => n + (v || s.mines[i] ? 0 : 1), 0);
const done = (s: State) => s.exploded !== null || s.won;

export const engine: RaceEngine<State, Action, Config | undefined> = {
  initialState(config, seed) {
    const { level } = configFrom(config);
    const { cols, rows, mines: count } = LEVELS[level];
    const rng = Rng.fromSeed(`${seed}:start:${level}`);
    // A start away from the edges, so its opening is a real one.
    const start = rng.int(2, rows - 3) * cols + rng.int(2, cols - 3);
    const n = cols * rows;
    return {
      level,
      cols,
      rows,
      count,
      seed,
      start,
      mines: [],
      open: new Array<number>(n).fill(0),
      flags: new Array<number>(n).fill(0),
      moves: 0,
      exploded: null,
      won: false,
    };
  },

  apply(state, action) {
    const { cols, rows } = state;
    const cell = action.cell;
    if (done(state) || !Number.isInteger(cell) || cell < 0 || cell >= cols * rows) return state;
    if (action.type === "flag") {
      if (state.open[cell] || state.mines.length === 0) return state;
      const flags = state.flags.slice();
      flags[cell] = flags[cell] ? 0 : 1;
      return { ...state, flags, moves: state.moves + 1 };
    }
    let mines = state.mines;
    let targets: number[];
    if (action.type === "reveal") {
      if (state.open[cell] || state.flags[cell]) return state;
      if (mines.length === 0) mines = layMines(state.seed, state.level, cell);
      targets = [cell];
    } else {
      // Chord: a revealed number with as many flags around it as mines.
      if (!state.open[cell] || mines.length === 0) return state;
      const near = around(cell, cols, rows);
      const flagged = near.filter((a) => state.flags[a]).length;
      if (flagged !== countAround(mines, cell, cols, rows)) return state;
      targets = near.filter((a) => !state.open[a] && !state.flags[a]);
      if (targets.length === 0) return state;
    }
    let open = state.open;
    let exploded: number | null = null;
    for (const t of targets) {
      open = flood(mines, open, state.flags, t, cols, rows);
      if (mines[t]) exploded ??= t;
    }
    const next = { ...state, mines, open, exploded, moves: state.moves + 1 };
    return { ...next, won: exploded === null && safeLeft(next) === 0 };
  },

  progress(state) {
    const safe = state.cols * state.rows - state.count;
    return state.mines.length === 0 ? 0 : (safe - safeLeft(state)) / safe;
  },

  result(state): GameResult | null {
    if (state.won) return { completed: true };
    if (state.exploded !== null) return { completed: false };
    return null;
  },
};
