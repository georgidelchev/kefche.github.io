// Memory Match rules (SPEC §20.3 #30): cards lie face down in pairs; turn
// two over, and a pair stays up. Alone, clear the table in the fewest flips
// and the least time. Together (on one device, or against bots), a player
// who finds a pair goes again, a miss passes the turn, and the most pairs
// wins. 12, 20 or 30 cards, laid out from the seed. Pure and deterministic.
import { Rng, type GameResult, type RaceEngine } from "@kefche/game-sdk";

export const SIZES = [20, 12, 30] as const;
export type Size = (typeof SIZES)[number];
/** Columns and rows of each layout, upright. */
export const LAYOUT: Record<Size, readonly [number, number]> = {
  12: [3, 4],
  20: [4, 5],
  30: [5, 6],
};

export interface Config {
  cards: Size;
}

export interface Action {
  flip: number;
}

export interface Table {
  /** Each card's symbol: two cards share each one. */
  symbols: number[];
  /** Cards turned up for good. */
  matched: boolean[];
  /** Cards turned up now: one, or a missed pair shown until the next flip. */
  up: number[];
  flips: number;
}

export interface State extends Table {
  cards: Size;
}

export const configFrom = (raw: unknown): Config => {
  const cards = (raw as { cards?: unknown } | null | undefined)?.cards;
  return { cards: SIZES.find((s) => s === cards) ?? 20 };
};

export function deal(cards: Size, seed: string): Table {
  const rng = Rng.fromSeed(`${seed}:memory-match:${String(cards)}`);
  const symbols = rng.shuffle(Array.from({ length: cards }, (_, i) => Math.floor(i / 2)));
  return { symbols, matched: symbols.map(() => false), up: [], flips: 0 };
}

export type Outcome = "none" | "first" | "match" | "miss";

/** Turns a card over: what happened, and the table after. */
export function flip<T extends Table>(table: T, card: number): { table: T; outcome: Outcome } {
  if (!Number.isInteger(card) || card < 0 || card >= table.symbols.length || table.matched[card]) {
    return { table, outcome: "none" };
  }
  // A missed pair goes face down as the next card turns.
  const up = table.up.length === 2 ? [] : table.up;
  if (up.includes(card)) return { table, outcome: "none" };
  const flips = table.flips + 1;
  const first = up[0];
  if (first === undefined) return { table: { ...table, up: [card], flips }, outcome: "first" };
  if (table.symbols[first] === table.symbols[card]) {
    const matched = table.matched.map((m, i) => m || i === first || i === card);
    return { table: { ...table, matched, up: [], flips }, outcome: "match" };
  }
  return { table: { ...table, up: [first, card], flips }, outcome: "miss" };
}

export const cleared = (table: Table) => table.matched.every(Boolean);

export const engine: RaceEngine<State, Action, Config | undefined> = {
  initialState(config, seed) {
    const { cards } = configFrom(config);
    return { cards, ...deal(cards, seed) };
  },
  apply(state, action) {
    if (cleared(state) || typeof action !== "object" || (action as unknown) === null) return state;
    return flip(state, action.flip).table;
  },
  progress: (state) => state.matched.filter(Boolean).length / state.matched.length,
  result: (state): GameResult | null =>
    cleared(state) ? { completed: true, score: state.flips } : null,
};

// Playing together on one device: seats take turns, a pair goes again.

export interface Party extends Table {
  cards: Size;
  seats: number;
  turn: number;
  pairs: number[];
}

export function startParty(cards: Size, seats: number, seed: string): Party {
  return {
    cards,
    ...deal(cards, seed),
    seats,
    turn: 0,
    pairs: Array.from({ length: seats }, () => 0),
  };
}

export function partyFlip(party: Party, card: number): { party: Party; outcome: Outcome } {
  const { table, outcome } = flip(party, card);
  if (outcome === "match") {
    const pairs = party.pairs.map((p, s) => (s === party.turn ? p + 1 : p));
    return { party: { ...table, pairs }, outcome };
  }
  if (outcome === "miss")
    return { party: { ...table, turn: (party.turn + 1) % party.seats }, outcome };
  return { party: table, outcome };
}

/** The winners when the table is clear (several on a tie), else null. */
export function partyWinners(party: Party): number[] | null {
  if (!cleared(party)) return null;
  const best = Math.max(...party.pairs);
  return party.pairs.flatMap((p, s) => (p === best ? [s] : []));
}
