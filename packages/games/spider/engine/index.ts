// Spider Solitaire (SPEC §20.2 #18): two decks (104 cards) in 1, 2 or 4
// suits, ten columns (six cards in the first four, five in the rest, the
// top one face up) and a stock of 50.
// - Put a card on one a rank higher, of any suit; move a run only when it's
//   one suit in order. Any card or run goes into an empty column.
// - A full run from king to ace in one suit leaves the table; eight of them
//   win. Tap the stock to deal one card onto every column (none may be
//   empty).
// - Undo takes back a move (not in races: it could show a face-down card).
import {
  ACE,
  Rng,
  SUITS,
  card,
  rankOf,
  suitOf,
  type Card,
  type GameResult,
  type RaceEngine,
  type Rank,
  type Suit,
} from "@kefche/game-sdk";

export interface Config {
  suits: 1 | 2 | 4;
}

export const configFrom = (raw: unknown): Config => {
  const s = (raw as { suits?: unknown } | null | undefined)?.suits;
  return { suits: s === 2 || s === 4 ? s : 1 };
};

export type Action =
  { move: { from: number; to: number; count: number } } | { deal: true } | { undo: true };

export interface Column {
  down: Card[];
  up: Card[];
}

interface Layout {
  columns: Column[];
  /** Cards left to deal, in dealing order. */
  stock: Card[];
  /** Runs completed so far. */
  done: number;
}

export interface State extends Layout {
  suits: 1 | 2 | 4;
  moves: number;
  history: Layout[];
}

/** Ace low. */
export const low = (c: Card): number => (rankOf(c) === ACE ? 1 : rankOf(c));

const SUIT_SETS: Record<1 | 2 | 4, readonly Suit[]> = {
  1: ["spades"],
  2: ["spades", "hearts"],
  4: SUITS,
};

function deal(config: Config, seed: string): Layout {
  const suits = SUIT_SETS[config.suits];
  const cards: Card[] = [];
  for (let set = 0; set < 8; set++) {
    const suit = suits[set % suits.length] ?? "spades";
    for (let r = 2; r <= 14; r++) cards.push(card(suit, r as Rank));
  }
  const deck = Rng.fromSeed(`spider:${seed}`).shuffle(cards);
  let at = 0;
  const columns: Column[] = Array.from({ length: 10 }, (_, i) => {
    const n = i < 4 ? 6 : 5;
    const col = deck.slice(at, at + n);
    at += n;
    return { down: col.slice(0, -1), up: col.slice(-1) };
  });
  return { columns, stock: deck.slice(at), done: 0 };
}

/** The longest run at the bottom of a column that can move together. */
export function movable(col: Column): number {
  let n = col.up.length > 0 ? 1 : 0;
  for (let i = col.up.length - 1; i > 0; i--) {
    const a = col.up[i] ?? 0;
    const b = col.up[i - 1] ?? 0;
    if (suitOf(a) === suitOf(b) && low(b) === low(a) + 1) n++;
    else break;
  }
  return n;
}

export function canMove(s: Layout, from: number, to: number, count: number): boolean {
  const a = s.columns[from];
  const b = s.columns[to];
  if (!a || !b || from === to || count < 1 || count > movable(a)) return false;
  const first = a.up[a.up.length - count];
  if (first === undefined) return false;
  const top = b.up.at(-1);
  return top === undefined ? b.down.length === 0 : low(top) === low(first) + 1;
}

/** Turns up a column's top card and clears a completed king-to-ace run. */
function settle(s: Layout): Layout {
  let done = s.done;
  const columns = s.columns.map((col) => {
    let c = { down: [...col.down], up: [...col.up] };
    if (movable(c) >= 13 && low(c.up.at(-1) ?? 0) === 1 && low(c.up.at(-13) ?? 0) === 13) {
      c = { down: c.down, up: c.up.slice(0, -13) };
      done++;
    }
    if (c.up.length === 0 && c.down.length > 0)
      c = { down: c.down.slice(0, -1), up: [c.down.at(-1) ?? 0] };
    return c;
  });
  return { ...s, columns, done };
}

const layout = (s: State): Layout => ({ columns: s.columns, stock: s.stock, done: s.done });
export const canDeal = (s: Layout): boolean =>
  s.stock.length >= 10 && s.columns.every((c) => c.up.length > 0);

export const engine: RaceEngine<State, Action, Config> = {
  initialState(config, seed) {
    const c = configFrom(config);
    return { ...deal(c, seed), suits: c.suits, moves: 0, history: [] };
  },
  apply(state, action) {
    if (state.done === 8) return state;
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
    if ("deal" in action) {
      if (!canDeal(state)) return state;
      const columns = state.columns.map((c, i) => ({
        down: c.down,
        up: [...c.up, state.stock[i] ?? 0],
      }));
      return save(settle({ ...layout(state), columns, stock: state.stock.slice(10) }));
    }
    const { from, to, count } = action.move;
    if (!canMove(state, from, to, count)) return state;
    const columns = state.columns.map((c) => ({ down: [...c.down], up: [...c.up] }));
    const a = columns[from];
    const b = columns[to];
    if (!a || !b) return state;
    const run = a.up.slice(-count);
    a.up = a.up.slice(0, -count);
    b.up = [...b.up, ...run];
    return save(settle({ ...layout(state), columns }));
  },
  progress(state) {
    return state.done / 8;
  },
  result(state): GameResult | null {
    return state.done === 8 ? { completed: true } : null;
  },
  allowedInRace(action) {
    return !("undo" in action);
  },
};
