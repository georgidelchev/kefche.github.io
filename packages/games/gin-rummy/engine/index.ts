// Gin Rummy (SPEC §20.2 #13): two players, ten cards each, a stock and a
// face-up discard pile.
// - A turn: draw the top card of the stock or of the discard pile, then
//   discard one (not the card just taken from the pile).
// - Melds: three or four cards of a rank, or three or more in a row of one
//   suit (ace low). Unmatched cards are deadwood: ace 1, face cards 10, the
//   rest their number.
// - With 10 or less deadwood after drawing, you may knock instead of just
//   discarding. The other player then lays off cards on your melds (done
//   for them) and the deadwood is compared: the knocker scores the
//   difference; if the other has as little or less, it's an undercut and
//   they score the difference plus 25. Knocking with no deadwood is gin:
//   25 plus the other's deadwood, and no laying off.
// - When only two cards are left in the stock and nobody has knocked, the
//   hand is a draw. The first to 100 wins.
import {
  ACE,
  Rng,
  hideCards,
  rankOf,
  shuffledDeck,
  suitOf,
  type Card,
  type GameResult,
  type RngState,
  type TurnEngine,
} from "@kefche/game-sdk";

export interface Config {
  target: 100 | 50;
}

export function configFrom(raw: unknown): Config {
  return { target: (raw as { target?: unknown } | undefined)?.target === 50 ? 50 : 100 };
}

export const GIN_BONUS = 25;
export const UNDERCUT_BONUS = 25;
export const KNOCK_LIMIT = 10;

/** Rank with the ace low (1–13). */
export const low = (c: Card): number => (rankOf(c) === ACE ? 1 : rankOf(c));
export const deadValue = (c: Card): number => Math.min(10, low(c));

export interface Melded {
  melds: Card[][];
  deadwood: Card[];
  points: number;
}

/** Every meld that can be made from these cards (sets of 3–4, runs of 3+). */
function candidates(cards: readonly Card[]): Card[][] {
  const out: Card[][] = [];
  const byRank = new Map<number, Card[]>();
  for (const c of cards) byRank.set(low(c), [...(byRank.get(low(c)) ?? []), c]);
  for (const group of byRank.values()) {
    if (group.length >= 3) {
      if (group.length === 3) out.push(group);
      else {
        out.push(group);
        for (let skip = 0; skip < 4; skip++) out.push(group.filter((_, i) => i !== skip));
      }
    }
  }
  for (const suit of ["clubs", "diamonds", "hearts", "spades"] as const) {
    const ranks = cards.filter((c) => suitOf(c) === suit).sort((a, b) => low(a) - low(b));
    for (let i = 0; i < ranks.length; i++) {
      let run = [ranks[i] ?? 0];
      for (let j = i + 1; j < ranks.length; j++) {
        const prev = run.at(-1) ?? 0;
        const c = ranks[j] ?? 0;
        if (low(c) !== low(prev) + 1) break;
        run = [...run, c];
        if (run.length >= 3) out.push(run);
      }
    }
  }
  return out;
}

const cache = new Map<string, Melded>();

/** The arrangement into melds with the least deadwood (remembered: replays ask often). */
export function bestMelds(cards: readonly Card[]): Melded {
  const key = [...cards].sort((a, b) => a - b).join();
  const known = cache.get(key);
  if (known) return known;
  const found = searchMelds(cards);
  if (cache.size > 5000) cache.clear();
  cache.set(key, found);
  return found;
}

function searchMelds(cards: readonly Card[]): Melded {
  const all = candidates(cards);
  let best: Melded = {
    melds: [],
    deadwood: [...cards],
    points: cards.reduce((n, c) => n + deadValue(c), 0),
  };
  const search = (from: number, used: Set<Card>, melds: Card[][]) => {
    const deadwood = cards.filter((c) => !used.has(c));
    const points = deadwood.reduce((n, c) => n + deadValue(c), 0);
    if (points < best.points) best = { melds, deadwood, points };
    for (let i = from; i < all.length; i++) {
      const meld = all[i] ?? [];
      if (meld.some((c) => used.has(c))) continue;
      const next = new Set(used);
      for (const c of meld) next.add(c);
      search(i + 1, next, [...melds, meld]);
    }
  };
  search(0, new Set(), []);
  return best;
}

/** Lays off what fits on `melds` (runs extended at either end, sets completed). */
export function layOff(
  melds: readonly Card[][],
  deadwood: readonly Card[],
): { laid: Card[]; left: Card[] } {
  const grown = melds.map((m) => [...m]);
  let left = [...deadwood];
  const laid: Card[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of left) {
      const target = grown.find((m) => {
        const isSet = m.every((x) => low(x) === low(m[0] ?? 0));
        if (isSet) return m.length < 4 && low(c) === low(m[0] ?? 0);
        if (suitOf(c) !== suitOf(m[0] ?? 0)) return false;
        const lows = m.map(low);
        return low(c) === Math.min(...lows) - 1 || low(c) === Math.max(...lows) + 1;
      });
      if (target) {
        target.push(c);
        laid.push(c);
        left = left.filter((x) => x !== c);
        changed = true;
        break;
      }
    }
  }
  return { laid, left };
}

export interface HandEnd {
  knocker: number;
  gin: boolean;
  undercut: boolean;
  /** Each player's melds and deadwood as shown at the end. */
  shown: Melded[];
  laid: Card[];
  points: [number, number];
}

export interface State {
  hands: [Card[], Card[]];
  /** Top card first. */
  stock: Card[];
  /** Top card last. */
  discard: Card[];
  turn: number;
  phase: "draw" | "discard";
  /** The card just taken from the discard pile (it can't go straight back). */
  taken: Card | null;
  /** Cards each player has taken from the discard pile this hand: everyone saw them. */
  pickups: [Card[], Card[]];
  dealer: number;
  scores: [number, number];
  /** The last hand's end, for showing (null after a drawn hand). */
  lastHand: HandEnd | null;
  hand: number;
  target: number;
  moves: number;
  rng: RngState;
}

export type Action = { draw: "stock" | "discard" } | { discard: Card } | { knock: Card };

function deal(base: Omit<State, "hands" | "stock" | "discard" | "rng">, rng: Rng): State {
  const deck = shuffledDeck(rng, 52);
  return {
    ...base,
    hands: [deck.slice(0, 10), deck.slice(10, 20)],
    discard: [deck[20] ?? 0],
    stock: deck.slice(21),
    turn: base.dealer === 0 ? 1 : 0,
    phase: "draw",
    taken: null,
    pickups: [[], []],
    rng: rng.state,
  };
}

function initialState(config: Config, _seats: number, seed: string): State {
  return deal(
    {
      turn: 1,
      phase: "draw",
      taken: null,
      pickups: [[], []],
      dealer: 0,
      scores: [0, 0],
      lastHand: null,
      hand: 0,
      target: config.target,
      moves: 0,
    },
    Rng.fromSeed(seed),
  );
}

const over = (state: State) =>
  state.phase === "draw" && state.scores.some((s) => s >= state.target);

function legalActions(state: State, seat: number): Action[] {
  if (over(state) || seat !== state.turn) return [];
  const hand = state.hands[seat as 0 | 1];
  if (state.phase === "draw") {
    const actions: Action[] = [{ draw: "stock" }];
    if (state.discard.length > 0) actions.push({ draw: "discard" });
    return actions;
  }
  const actions: Action[] = [];
  // Dropping a card lowers the deadwood by its value at most, so most hands
  // can't knock with any card: only the rest need the meld search.
  const whole = bestMelds(hand).points;
  for (const c of hand) {
    if (c === state.taken) continue;
    actions.push({ discard: c });
    if (whole - deadValue(c) > KNOCK_LIMIT) continue;
    if (bestMelds(hand.filter((x) => x !== c)).points <= KNOCK_LIMIT) actions.push({ knock: c });
  }
  return actions;
}

const same = (a: Action, b: Action): boolean => JSON.stringify(a) === JSON.stringify(b);

function nextHand(state: State, end: HandEnd | null): State {
  const scores: [number, number] = [...state.scores];
  if (end) {
    scores[0] += end.points[0];
    scores[1] += end.points[1];
  }
  const after = { ...state, scores, lastHand: end, hand: state.hand + 1 };
  if (scores.some((s) => s >= state.target)) return { ...after, phase: "draw" };
  return deal({ ...after, dealer: state.dealer === 0 ? 1 : 0 }, new Rng(state.rng));
}

function applyAction(state: State, seat: number, action: Action): State {
  if (!legalActions(state, seat).some((a) => same(a, action))) return state;
  const me = seat as 0 | 1;
  const moves = state.moves + 1;
  const hands: [Card[], Card[]] = [[...state.hands[0]], [...state.hands[1]]];
  if ("draw" in action) {
    if (action.draw === "stock") {
      const [card, ...stock] = state.stock;
      if (card === undefined) return state;
      hands[me] = [...hands[me], card];
      return { ...state, hands, stock, phase: "discard", taken: null, moves };
    }
    const card = state.discard.at(-1);
    if (card === undefined) return state;
    hands[me] = [...hands[me], card];
    const pickups: [Card[], Card[]] = [[...state.pickups[0]], [...state.pickups[1]]];
    pickups[me] = [...pickups[me], card];
    return {
      ...state,
      hands,
      discard: state.discard.slice(0, -1),
      phase: "discard",
      taken: card,
      pickups,
      moves,
    };
  }
  const card = "discard" in action ? action.discard : action.knock;
  hands[me] = hands[me].filter((c) => c !== card);
  const discard = [...state.discard, card];
  const next: State = { ...state, hands, discard, moves };
  if ("knock" in action) {
    const knocker = bestMelds(hands[me]);
    const them = me === 0 ? 1 : 0;
    const defender = bestMelds(hands[them]);
    const gin = knocker.points === 0;
    const { laid, left } = gin
      ? { laid: [], left: defender.deadwood }
      : layOff(knocker.melds, defender.deadwood);
    const theirs = left.reduce((n, c) => n + deadValue(c), 0);
    const points: [number, number] = [0, 0];
    let undercut = false;
    if (gin) points[me] = GIN_BONUS + theirs;
    else if (theirs <= knocker.points) {
      undercut = true;
      points[them] = knocker.points - theirs + UNDERCUT_BONUS;
    } else points[me] = theirs - knocker.points;
    const shown: Melded[] = [];
    shown[me] = knocker;
    shown[them] = { melds: defender.melds, deadwood: left, points: theirs };
    return { ...nextHand(next, { knocker: seat, gin, undercut, shown, laid, points }), moves };
  }
  // A plain discard: the turn passes; a stock down to two ends the hand drawn.
  if (state.stock.length <= 2) return { ...nextHand(next, null), moves };
  return { ...next, turn: me === 0 ? 1 : 0, phase: "draw", taken: null };
}

function currentSeats(state: State): number[] {
  return over(state) ? [] : [state.turn];
}

function result(state: State): GameResult | null {
  if (!over(state)) return null;
  return { completed: true, outcome: state.scores[0] >= state.scores[1] ? [1, 0] : [0, 1] };
}

/** The other hand and the stock are face down; the discard pile is public. */
function view(state: State, seat: number | null): State {
  return {
    ...state,
    hands: [
      seat === 0 ? state.hands[0] : hideCards(state.hands[0]),
      seat === 1 ? state.hands[1] : hideCards(state.hands[1]),
    ],
    stock: hideCards(state.stock),
    rng: [0, 0, 0, 0],
  };
}

export const engine: TurnEngine<State, Action, Config> = {
  initialState,
  legalActions,
  applyAction,
  currentSeats,
  result,
  view,
};
