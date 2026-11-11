// Santase, Bulgarian Sixty-Six (SPEC §20.2 #12): two players, 24 cards
// (9, jack, queen, king, 10, ace). Six cards each; the next card is turned
// up as trumps and lies under the stock.
// - While the stock lasts, play any card; the higher card of the suit led,
//   or a trump, takes the trick. The winner draws first, then the other.
// - Once the stock is gone, or closed by the leader, follow suit and beat
//   the card if you can, or trump if you can't follow.
// - Points: A 11, 10 10, K 4, Q 3, J 2, 9 0. A king and queen of one suit,
//   led together, are a marriage: 20, or 40 in trumps (announced
//   automatically; they count once you've taken a trick). The leader may
//   swap the nine of trumps for the face-up trump while three or more cards
//   are left in the stock, and may close it.
// - Reaching 66 ends the deal at once: 1 game point, 2 if the other has
//   under 33, 3 if they've taken no trick. A closer who doesn't reach 66
//   gives the other 2. Played out, the last trick is worth 10 and the
//   higher total wins. First to 11 game points wins.
import {
  ACE,
  JACK,
  KING,
  QUEEN,
  Rng,
  HIDDEN,
  hideCards,
  rankOf,
  shuffledDeck,
  sortHand,
  suitOf,
  type Card,
  type GameResult,
  type RngState,
  type Suit,
  type TurnEngine,
} from "@kefche/game-sdk";

export const TARGET = 11;
export const ORDER = [9, JACK, QUEEN, KING, 10, ACE];
const VALUES: Record<number, number> = { [ACE]: 11, 10: 10, [KING]: 4, [QUEEN]: 3, [JACK]: 2 };
export const value = (c: Card): number => VALUES[rankOf(c)] ?? 0;
export const strength = (c: Card): number => ORDER.indexOf(rankOf(c));

export interface Play {
  seat: number;
  card: Card;
}

export interface State {
  hands: [Card[], Card[]];
  /** Face-down cards, top first; the last is the face-up trump card. */
  stock: Card[];
  trump: Suit;
  /** The seat that closed the stock, if one did. */
  closed: number | null;
  /** Points taken this deal (cards and marriages that count). */
  points: [number, number];
  /** Marriages announced before taking a trick: they count after the first. */
  pending: [number, number];
  tricks: [number, number];
  /** Suits whose marriage has been announced, by seat. */
  marriages: { seat: number; suit: Suit }[];
  leader: number;
  turn: number;
  trick: Play[];
  lastTrick: { plays: Play[]; winner: number } | null;
  dealer: number;
  scores: [number, number];
  lastDeal: { winner: number; points: number } | null;
  moves: number;
  rng: RngState;
}

export type Action = { play: Card } | { exchange: true } | { close: true };

const other = (seat: number): 0 | 1 => (seat === 0 ? 1 : 0);

function deal(base: Omit<State, "hands" | "stock" | "trump" | "rng">, rng: Rng): State {
  const deck = shuffledDeck(rng, 24);
  const trumpCard = deck[12] ?? 0;
  return {
    ...base,
    hands: [sortHand(deck.slice(0, 6)), sortHand(deck.slice(6, 12))],
    stock: [...deck.slice(13), trumpCard],
    trump: suitOf(trumpCard),
    closed: null,
    points: [0, 0],
    pending: [0, 0],
    tricks: [0, 0],
    marriages: [],
    leader: other(base.dealer),
    turn: other(base.dealer),
    trick: [],
    rng: rng.state,
  };
}

function initialState(_config: unknown, _seats: number, seed: string): State {
  return deal(
    {
      closed: null,
      points: [0, 0],
      pending: [0, 0],
      tricks: [0, 0],
      marriages: [],
      leader: 1,
      turn: 1,
      trick: [],
      lastTrick: null,
      dealer: 0,
      scores: [0, 0],
      lastDeal: null,
      moves: 0,
    },
    Rng.fromSeed(seed),
  );
}

const strict = (state: State) => state.closed !== null || state.stock.length === 0;
export const trumpCard = (state: State): Card | null => state.stock.at(-1) ?? null;
const over = (state: State) => state.scores.some((s) => s >= TARGET);

export function beats(state: State, a: Card, led: Card): boolean {
  if (suitOf(a) === suitOf(led)) return strength(a) > strength(led);
  return suitOf(a) === state.trump;
}

export function playable(state: State, seat: number): Card[] {
  const hand = state.hands[seat as 0 | 1];
  const led = state.trick[0];
  if (!led || !strict(state)) return hand;
  const follow = hand.filter((c) => suitOf(c) === suitOf(led.card));
  if (follow.length > 0) {
    const higher = follow.filter((c) => strength(c) > strength(led.card));
    return higher.length > 0 ? higher : follow;
  }
  const trumps = hand.filter((c) => suitOf(c) === state.trump);
  return trumps.length > 0 ? trumps : hand;
}

function legalActions(state: State, seat: number): Action[] {
  if (over(state) || seat !== state.turn) return [];
  const actions: Action[] = playable(state, seat).map((c) => ({ play: c }));
  const leading = state.trick.length === 0;
  const open = state.closed === null && state.stock.length >= 3;
  if (leading && open) {
    const nine = state.hands[seat as 0 | 1].find(
      (c) => suitOf(c) === state.trump && rankOf(c) === 9,
    );
    const up = trumpCard(state);
    if (nine !== undefined && up !== null && rankOf(up) !== 9) actions.push({ exchange: true });
    actions.push({ close: true });
  }
  return actions;
}

/** Ends the deal: who wins it, and how many game points. */
function finish(state: State, winner: number, points: number): State {
  const scores: [number, number] = [...state.scores];
  scores[winner as 0 | 1] += points;
  const after: State = { ...state, scores, lastDeal: { winner, points } };
  if (scores.some((s) => s >= TARGET)) return after;
  return deal({ ...after, dealer: other(state.dealer), lastTrick: null }, new Rng(state.rng));
}

/** Game points for reaching 66 against an opponent with these points and tricks. */
const gamePoints = (theirPoints: number, theirTricks: number) =>
  theirTricks === 0 ? 3 : theirPoints < 33 ? 2 : 1;

function applyAction(state: State, seat: number, action: Action): State {
  const legal = legalActions(state, seat).some(
    (a) =>
      ("play" in a && "play" in action && a.play === action.play) ||
      ("exchange" in a && "exchange" in action) ||
      ("close" in a && "close" in action),
  );
  if (!legal) return state;
  const moves = state.moves + 1;
  const me = seat as 0 | 1;
  if ("exchange" in action) {
    const up = trumpCard(state);
    const nine = state.hands[me].find((c) => suitOf(c) === state.trump && rankOf(c) === 9);
    if (up === null || nine === undefined) return state;
    const hands: [Card[], Card[]] = [[...state.hands[0]], [...state.hands[1]]];
    hands[me] = sortHand([...hands[me].filter((c) => c !== nine), up]);
    return { ...state, hands, stock: [...state.stock.slice(0, -1), nine], moves };
  }
  if ("close" in action) return { ...state, closed: seat, moves };
  const card = action.play;
  const hands: [Card[], Card[]] = [[...state.hands[0]], [...state.hands[1]]];
  // A marriage: leading a king or queen with its partner in hand.
  let { points, pending, marriages } = state;
  if (state.trick.length === 0 && (rankOf(card) === KING || rankOf(card) === QUEEN)) {
    const mate = rankOf(card) === KING ? QUEEN : KING;
    const suit = suitOf(card);
    if (
      hands[me].some((c) => suitOf(c) === suit && rankOf(c) === mate) &&
      !marriages.some((m) => m.suit === suit)
    ) {
      const worth = suit === state.trump ? 40 : 20;
      marriages = [...marriages, { seat, suit }];
      if (state.tricks[me] > 0) {
        points = [...points];
        points[me] += worth;
      } else {
        pending = [...pending];
        pending[me] += worth;
      }
    }
  }
  hands[me] = hands[me].filter((c) => c !== card);
  const trick = [...state.trick, { seat, card }];
  let next: State = { ...state, hands, points, pending, marriages, moves };
  if (points[me] >= 66)
    return finish(next, me, gamePoints(points[other(me)], state.tricks[other(me)]));
  if (trick.length < 2) return { ...next, trick, turn: other(seat) };
  const [lead, reply] = trick as [Play, Play];
  const winner = beats(state, reply.card, lead.card) ? reply.seat : lead.seat;
  const w = winner as 0 | 1;
  const lastOut = hands[0].length === 0 && hands[1].length === 0;
  const taken: [number, number] = [...next.points];
  taken[w] +=
    value(lead.card) +
    value(reply.card) +
    next.pending[w] +
    (lastOut && next.closed === null ? 10 : 0);
  const stillPending: [number, number] = [...next.pending];
  stillPending[w] = 0;
  const tricks: [number, number] = [...state.tricks];
  tricks[w] += 1;
  next = {
    ...next,
    points: taken,
    pending: stillPending,
    tricks,
    trick: [],
    lastTrick: { plays: trick, winner },
    leader: winner,
    turn: winner,
  };
  if (taken[w] >= 66) return finish(next, w, gamePoints(taken[other(w)], tricks[other(w)]));
  if (lastOut) {
    // Played out: a closer who fell short loses 2; otherwise the higher total wins.
    if (next.closed !== null) return finish(next, other(next.closed), 2);
    const top = taken[0] === taken[1] ? winner : taken[0] > taken[1] ? 0 : 1;
    return finish(next, top, 1);
  }
  // Draw: the winner first, while the stock lasts and it isn't closed.
  if (next.closed === null && next.stock.length > 0) {
    const stock = [...next.stock];
    const first = stock.shift();
    const second = stock.shift();
    const h: [Card[], Card[]] = [[...hands[0]], [...hands[1]]];
    if (first !== undefined) h[w] = sortHand([...h[w], first]);
    if (second !== undefined) h[other(w)] = sortHand([...h[other(w)], second]);
    next = { ...next, hands: h, stock };
  }
  return next;
}

function currentSeats(state: State): number[] {
  return over(state) ? [] : [state.turn];
}

function result(state: State): GameResult | null {
  if (!over(state)) return null;
  return { completed: true, outcome: state.scores[0] > state.scores[1] ? [1, 0] : [0, 1] };
}

/** The other hand and the stock are face down, but for the trump card under it. */
function view(state: State, seat: number | null): State {
  const up = trumpCard(state);
  return {
    ...state,
    hands: [
      seat === 0 ? state.hands[0] : hideCards(state.hands[0]),
      seat === 1 ? state.hands[1] : hideCards(state.hands[1]),
    ],
    stock: state.stock.map((c, i) => (i === state.stock.length - 1 && up !== null ? c : HIDDEN)),
    rng: [0, 0, 0, 0],
  };
}

export const engine: TurnEngine<State, Action> = {
  initialState,
  legalActions,
  applyAction,
  currentSeats,
  result,
  view,
};
