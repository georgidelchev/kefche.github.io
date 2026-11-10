// Tower of Hanoi rules (SPEC §20.3 #27): 3 to 8 discs (4 by default) start
// on the left peg, largest at the bottom. Move them all to the right peg,
// one disc at a time, never putting a larger disc on a smaller one. The
// fewest moves possible is 2ⁿ − 1. Pure and deterministic (the start is the
// same for every seed).
import type { GameResult, RaceEngine } from "@kefche/game-sdk";

export const DISCS = [4, 3, 5, 6, 7, 8] as const;
export type Discs = (typeof DISCS)[number];

export interface Config {
  discs: Discs;
}

export interface Action {
  from: number;
  to: number;
}

export interface State {
  discs: Discs;
  /** Each peg's discs from the bottom, by size (1 is the smallest). */
  pegs: [number[], number[], number[]];
  moves: number;
}

export const configFrom = (raw: unknown): Config => {
  const discs = (raw as { discs?: unknown } | null | undefined)?.discs;
  return { discs: DISCS.find((d) => d === discs) ?? 4 };
};

export const fewest = (discs: number) => 2 ** discs - 1;
export const top = (peg: readonly number[]) => peg.at(-1);

export function canMove(state: State, from: number, to: number): boolean {
  const peg = (i: number) => (i === 0 || i === 1 || i === 2 ? state.pegs[i] : null);
  const a = peg(from);
  const b = peg(to);
  if (from === to || !a || !b) return false;
  const disc = top(a);
  if (disc === undefined) return false;
  const under = top(b);
  return under === undefined || under > disc;
}

const solved = (state: State) => state.pegs[2].length === state.discs;

export const engine: RaceEngine<State, Action, Config | undefined> = {
  initialState(config) {
    const { discs } = configFrom(config);
    return { discs, pegs: [Array.from({ length: discs }, (_, i) => discs - i), [], []], moves: 0 };
  },

  apply(state, { from, to }) {
    if (solved(state) || !canMove(state, from, to)) return state;
    const pegs = state.pegs.map((p) => p.slice()) as State["pegs"];
    const disc = pegs[from as 0 | 1 | 2].pop() ?? 0;
    pegs[to as 0 | 1 | 2].push(disc);
    return { ...state, pegs, moves: state.moves + 1 };
  },

  // The discs already in their final place on the right peg, from the bottom.
  progress(state) {
    let n = 0;
    for (const [i, disc] of state.pegs[2].entries()) {
      if (disc !== state.discs - i) break;
      n++;
    }
    return n / state.discs;
  },

  result: (state): GameResult | null =>
    solved(state) ? { completed: true, score: state.moves } : null,

  score: (state) => state.moves,
};
