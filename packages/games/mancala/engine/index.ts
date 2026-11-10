// Mancala with Kalah rules (SPEC §20.1 #10): two rows of six pits and a
// store for each player, 3 to 6 seeds a pit (4 by default). On your turn you
// take every seed from one of your pits and sow them one by one
// counter-clockwise, into your own store but never your opponent's.
// - The last seed in your store: another turn.
// - The last seed in an empty pit of yours, with seeds opposite: you capture
//   it and the seeds opposite into your store.
// When one side's pits are all empty, the game ends and the other player
// puts the seeds left on their side into their store. More seeds wins.
// Pure and deterministic.
import type { GameResult, TurnEngine } from "@kefche/game-sdk";

export const PITS = 6;
/** Seat 0: pits 0–5 and store 6; seat 1: pits 7–12 and store 13. */
export const STORE = [6, 13] as const;
export const SEEDS = [4, 3, 5, 6] as const;

export interface Config {
  seeds: number;
}

export interface Action {
  pit: number;
}

export interface State {
  /** 14 holes: each seat's six pits, then its store. */
  holes: number[];
  turn: number;
  moves: number;
  /** The last sowing: the pit emptied and the holes it reached, in order. */
  last: { seat: number; pit: number; path: number[]; captured: number; again: boolean } | null;
  over: boolean;
}

export const configFrom = (raw: unknown): Config => {
  const seeds = (raw as { seeds?: unknown } | null | undefined)?.seeds;
  return { seeds: SEEDS.find((s) => s === seeds) ?? 4 };
};

/** A seat's six pits, in sowing order. */
export const pitsOf = (seat: number) => Array.from({ length: PITS }, (_, i) => seat * 7 + i);
export const opposite = (pit: number) => 12 - pit;
export const ownerOf = (hole: number) => (hole <= 6 ? 0 : 1);

export function movesFor(state: State, seat: number): number[] {
  return pitsOf(seat).filter((pit) => (state.holes[pit] ?? 0) > 0);
}

const sideTotal = (holes: readonly number[], seat: number) =>
  pitsOf(seat).reduce((n, p) => n + (holes[p] ?? 0), 0);

export const score = (state: State, seat: number) => state.holes[STORE[seat === 0 ? 0 : 1]] ?? 0;

export const engine: TurnEngine<State, Action, Config | undefined> = {
  initialState(config) {
    const { seeds } = configFrom(config);
    const holes = Array.from({ length: 14 }, (_, i) => (i === 6 || i === 13 ? 0 : seeds));
    return { holes, turn: 0, moves: 0, last: null, over: false };
  },

  legalActions(state, seat) {
    if (state.over || seat !== state.turn) return [];
    return movesFor(state, seat).map((pit) => ({ pit }));
  },

  applyAction(state, seat, { pit }) {
    if (state.over || seat !== state.turn || !movesFor(state, seat).includes(pit)) return state;
    const holes = state.holes.slice();
    let seeds = holes[pit] ?? 0;
    holes[pit] = 0;
    const theirs = STORE[seat === 0 ? 1 : 0];
    const mine = STORE[seat === 0 ? 0 : 1];
    const path: number[] = [];
    let at = pit;
    while (seeds > 0) {
      at = (at + 1) % 14;
      if (at === theirs) continue;
      holes[at] = (holes[at] ?? 0) + 1;
      path.push(at);
      seeds--;
    }
    let captured = 0;
    // The last seed in an empty pit of your own, with seeds opposite: capture both.
    if (at !== mine && ownerOf(at) === seat && holes[at] === 1 && (holes[opposite(at)] ?? 0) > 0) {
      captured = 1 + (holes[opposite(at)] ?? 0);
      holes[mine] = (holes[mine] ?? 0) + captured;
      holes[at] = 0;
      holes[opposite(at)] = 0;
    }
    const again = at === mine;
    const last = { seat, pit, path, captured, again };
    const base = { ...state, holes, moves: state.moves + 1, last };
    // One side empty: the other takes what's left on its side, and the game ends.
    if (sideTotal(holes, 0) === 0 || sideTotal(holes, 1) === 0) {
      for (const s of [0, 1]) {
        const store = STORE[s === 0 ? 0 : 1];
        holes[store] = (holes[store] ?? 0) + sideTotal(holes, s);
        for (const p of pitsOf(s)) holes[p] = 0;
      }
      return { ...base, holes, over: true };
    }
    return { ...base, turn: again ? seat : 1 - seat };
  },

  currentSeats: (state) => (state.over ? [] : [state.turn]),

  // Online, an away player's turn passes.
  skipTurn(state, seat) {
    if (state.over || seat !== state.turn) return state;
    return { ...state, turn: 1 - seat, last: null };
  },

  result(state): GameResult | null {
    if (!state.over) return null;
    const a = score(state, 0);
    const b = score(state, 1);
    return { completed: true, outcome: a === b ? [0.5, 0.5] : a > b ? [1, 0] : [0, 1] };
  },
};
