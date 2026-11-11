// Klondike Solitaire (SPEC §20.2 #17): the classic patience. Seven columns
// of 1 to 7 cards, the top one face up; the rest of the deck is the stock.
// - Build the columns down in alternating colours; only a king (or a run
//   starting with one) goes in an empty column. Move any face-up run.
// - Build the four foundations up by suit from the ace. Win with all 52.
// - Draw from the stock one card at a time, or three (only the top one of
//   the waste can be played); when the stock is empty, turn the waste over.
// - Undo takes back a move (not in races: it would show a face-down card
//   and hide it again). Finish plays every card up once all are face up.
// "Winnable" deals come from a bank of seeds a solver has won
// (engine/bank.gen.ts, scripts/klondike-bank.mjs).
import {
  ACE,
  Rng,
  isRed,
  rankOf,
  shuffledDeck,
  suitOf,
  SUITS,
  type Card,
  type GameResult,
  type RaceEngine,
} from "@kefche/game-sdk";

import { WINNABLE } from "./bank.gen";

export interface Config {
  draw: 1 | 3;
  deal: "random" | "winnable";
}

export const configFrom = (raw: unknown): Config => {
  const r = (raw ?? {}) as { draw?: unknown; deal?: unknown };
  return { draw: r.draw === 3 ? 3 : 1, deal: r.deal === "random" ? "random" : "winnable" };
};

/** A place cards come from or go to. */
export type Pile = { waste: true } | { column: number } | { foundation: number };

export type Action =
  | { draw: true }
  | { move: { from: Pile; to: Pile; count: number } }
  | { undo: true }
  | { finish: true };

export interface Column {
  down: Card[];
  up: Card[];
}

interface Layout {
  columns: Column[];
  /** Top card last. */
  stock: Card[];
  /** Top card last. */
  waste: Card[];
  /** By suit index, top card last. */
  foundations: Card[][];
}

export interface State extends Layout {
  draw: 1 | 3;
  moves: number;
  /** Earlier layouts, for undo (the latest last). */
  history: Layout[];
}

/** Ace low. */
export const low = (c: Card): number => (rankOf(c) === ACE ? 1 : rankOf(c));
const suitIndex = (c: Card) => SUITS.indexOf(suitOf(c));

function deal(seed: string): Layout {
  const deck = shuffledDeck(Rng.fromSeed(seed), 52);
  let at = 0;
  const columns: Column[] = Array.from({ length: 7 }, (_, i) => {
    const cards = deck.slice(at, at + i + 1);
    at += i + 1;
    return { down: cards.slice(0, -1), up: cards.slice(-1) };
  });
  return { columns, stock: deck.slice(at), waste: [], foundations: [[], [], [], []] };
}

/** The deal a seed and config start with: a winnable deal is picked from the bank by the seed. */
export function dealSeed(config: Config, seed: string): string {
  if (config.deal === "random") return `klondike:${seed}`;
  const bank = WINNABLE[config.draw];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return bank[h % bank.length] ?? `klondike:${seed}`;
}

const layout = (s: State): Layout => ({
  columns: s.columns,
  stock: s.stock,
  waste: s.waste,
  foundations: s.foundations,
});

/** The cards a move would lift, or null when it can't. */
function lift(s: Layout, from: Pile, count: number): Card[] | null {
  if ("waste" in from) return count === 1 && s.waste.length > 0 ? s.waste.slice(-1) : null;
  if ("foundation" in from) {
    const f = s.foundations[from.foundation] ?? [];
    return count === 1 && f.length > 0 ? f.slice(-1) : null;
  }
  const col = s.columns[from.column];
  if (!col || count < 1 || count > col.up.length) return null;
  return col.up.slice(-count);
}

export function fitsFoundation(s: Layout, c: Card, f: number): boolean {
  if (suitIndex(c) !== f) return false;
  const top = s.foundations[f]?.at(-1);
  return top === undefined ? low(c) === 1 : low(c) === low(top) + 1;
}

export function fitsColumn(s: Layout, c: Card, i: number): boolean {
  const col = s.columns[i];
  if (!col) return false;
  const top = col.up.at(-1);
  if (top === undefined) return col.down.length === 0 && low(c) === 13;
  return low(c) === low(top) - 1 && isRed(c) !== isRed(top);
}

export function canMove(s: Layout, from: Pile, to: Pile, count: number): boolean {
  const cards = lift(s, from, count);
  if (!cards) return false;
  const first = cards[0] ?? -1;
  if ("foundation" in to)
    return (
      cards.length === 1 &&
      !("foundation" in from && from.foundation === to.foundation) &&
      fitsFoundation(s, first, to.foundation)
    );
  if ("column" in to) {
    if ("column" in from && from.column === to.column) return false;
    return fitsColumn(s, first, to.column);
  }
  return false;
}

function move(s: Layout, from: Pile, to: Pile, count: number): Layout {
  const cards = lift(s, from, count) ?? [];
  const columns = s.columns.map((c) => ({ down: [...c.down], up: [...c.up] }));
  const foundations = s.foundations.map((f) => [...f]);
  let waste = [...s.waste];
  if ("waste" in from) waste = waste.slice(0, -1);
  else if ("foundation" in from)
    foundations[from.foundation] = (foundations[from.foundation] ?? []).slice(0, -1);
  else {
    const col = columns[from.column];
    if (col) {
      col.up = col.up.slice(0, -count);
      // The card underneath turns face up.
      if (col.up.length === 0 && col.down.length > 0) col.up = [col.down.pop() ?? 0];
    }
  }
  if ("foundation" in to)
    foundations[to.foundation] = [...(foundations[to.foundation] ?? []), ...cards];
  else if ("column" in to) {
    const col = columns[to.column];
    if (col) col.up = [...col.up, ...cards];
  }
  return { ...s, columns, foundations, waste };
}

const allUp = (s: Layout) =>
  s.stock.length === 0 && s.waste.length === 0 && s.columns.every((c) => c.down.length === 0);
const won = (s: Layout) => s.foundations.every((f) => f.length === 13);

/** Plays every card it can to the foundations (once all are face up). */
function finish(s: Layout): Layout {
  let cur = s;
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < 7; i++) {
      const top = cur.columns[i]?.up.at(-1);
      if (top === undefined) continue;
      const f = suitIndex(top);
      if (fitsFoundation(cur, top, f)) {
        cur = move(cur, { column: i }, { foundation: f }, 1);
        changed = true;
      }
    }
  }
  return cur;
}

export const engine: RaceEngine<State, Action, Config> = {
  initialState(config, seed) {
    const c = configFrom(config);
    return { ...deal(dealSeed(c, seed)), draw: c.draw, moves: 0, history: [] };
  },
  apply(state, action) {
    if (won(state)) return state;
    if ("undo" in action) {
      const prev = state.history.at(-1);
      return prev
        ? { ...state, ...prev, history: state.history.slice(0, -1), moves: state.moves + 1 }
        : state;
    }
    const save = (next: Layout): State => ({
      ...state,
      ...next,
      moves: state.moves + 1,
      history: [...state.history.slice(-199), layout(state)],
    });
    if ("draw" in action) {
      if (state.stock.length === 0) {
        if (state.waste.length === 0) return state;
        return save({ ...layout(state), stock: [...state.waste].reverse(), waste: [] });
      }
      const n = Math.min(state.draw, state.stock.length);
      const drawn = state.stock.slice(-n).reverse();
      return save({
        ...layout(state),
        stock: state.stock.slice(0, -n),
        waste: [...state.waste, ...drawn],
      });
    }
    if ("finish" in action) {
      if (!allUp(state)) return state;
      return save(finish(state));
    }
    const { from, to, count } = action.move;
    if (!canMove(state, from, to, count)) return state;
    return save(move(state, from, to, count));
  },
  progress(state) {
    return state.foundations.reduce((n, f) => n + f.length, 0) / 52;
  },
  result(state): GameResult | null {
    return won(state) ? { completed: true } : null;
  },
  // Undo would show a face-down card and hide it again: not in a race.
  allowedInRace(action) {
    return !("undo" in action);
  },
};

export const canFinish = allUp;
