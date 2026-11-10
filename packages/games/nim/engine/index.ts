// Nim rules (SPEC §20.9 #87): 2–5 players take turns removing one or more
// sticks from a single pile. In normal play, whoever takes the last stick
// wins; with the misère option, whoever takes it loses (and everyone else
// wins). The piles are the classic 1, 3, 5, 7, or seeded at random: 3 to 5
// piles of 1 to 7. Pure and deterministic.
import { Rng, type GameResult, type TurnEngine } from "@kefche/game-sdk";

export interface Config {
  piles: "classic" | "random";
  misere: boolean;
}

export interface Action {
  pile: number;
  take: number;
}

export interface State {
  piles: number[];
  seats: number;
  misere: boolean;
  turn: number;
  moves: number;
  last: { seat: number; pile: number; take: number } | null;
  /** The seat that took the last stick, once the piles are empty. */
  lastTaker: number | null;
}

export const CLASSIC = [1, 3, 5, 7];

export const configFrom = (raw: unknown): Config => {
  const c = (raw ?? {}) as { piles?: unknown; misere?: unknown };
  return { piles: c.piles === "random" ? "random" : "classic", misere: c.misere === true };
};

export function startingPiles(config: Config, seed: string): number[] {
  if (config.piles === "classic") return [...CLASSIC];
  const rng = Rng.fromSeed(`${seed}:piles`);
  return Array.from({ length: rng.int(3, 5) }, () => rng.int(1, 7));
}

export const nimSum = (piles: readonly number[]) => piles.reduce((x, p) => x ^ p, 0);
export const total = (piles: readonly number[]) => piles.reduce((n, p) => n + p, 0);

export const engine: TurnEngine<State, Action, Config | undefined> = {
  initialState(config, seats, seed) {
    const c = configFrom(config);
    return {
      piles: startingPiles(c, seed),
      seats,
      misere: c.misere,
      turn: 0,
      moves: 0,
      last: null,
      lastTaker: null,
    };
  },

  legalActions(state, seat) {
    if (state.lastTaker !== null || seat !== state.turn) return [];
    return state.piles.flatMap((size, pile) =>
      Array.from({ length: size }, (_, i) => ({ pile, take: i + 1 })),
    );
  },

  applyAction(state, seat, { pile, take }) {
    if (state.lastTaker !== null || seat !== state.turn) return state;
    const size = state.piles[pile];
    if (size === undefined || !Number.isInteger(take) || take < 1 || take > size) return state;
    const piles = state.piles.slice();
    piles[pile] = size - take;
    const base = { ...state, piles, moves: state.moves + 1, last: { seat, pile, take } };
    if (total(piles) === 0) return { ...base, lastTaker: seat };
    return { ...base, turn: (seat + 1) % state.seats };
  },

  currentSeats: (state) => (state.lastTaker === null ? [state.turn] : []),

  // Online, an away player's turn passes to the next seat.
  skipTurn(state, seat) {
    if (state.lastTaker !== null || seat !== state.turn) return state;
    return { ...state, turn: (seat + 1) % state.seats, last: null };
  },

  result(state): GameResult | null {
    if (state.lastTaker === null) return null;
    const taker = state.lastTaker;
    const outcome = Array.from({ length: state.seats }, (_, s) =>
      state.misere ? (s === taker ? 0 : 1) : s === taker ? 1 : 0,
    );
    return { completed: true, outcome };
  },
};
