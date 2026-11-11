// Belote, Bulgarian rules (SPEC §20.2 #11): four players in two teams (0
// and 2 against 1 and 3), a 32-card deck (7 to ace), play counter-clockwise.
// - Deal: five cards each, bidding, then three more.
// - Bidding, from the dealer's right: pass, or a higher contract: clubs,
//   diamonds, hearts, spades, No Trumps, All Trumps. The other team may
//   double, and the bidders redouble; a higher bid clears it. Three passes
//   after a call end the bidding; four passes at the start mean a new deal.
// - Play: follow suit. In a suit contract, a player who can't follow must
//   trump (over-trumping if they can) unless their partner is winning; on a
//   trump lead, play higher if you can. In All Trumps, play higher in the
//   suit led if you can. In No Trumps, just follow.
// - Points: trumps J 20, 9 14, A 11, 10 10, K 4, Q 3; other suits A 11,
//   10 10, K 4, Q 3, J 2. The last trick is 10. No Trumps counts double.
//   Declarations, made automatically as play starts (not in No Trumps):
//   tierce 20, quarte 50, quinte 100, four jacks 200, four nines 150, four
//   aces, kings, queens or tens 100; only the team with the best sequence
//   scores its sequences. Belote (king and queen of trumps) is 20. All eight
//   tricks (valat) add 90.
// - The bidders must score more than the others, or everything goes to the
//   others ("inside"); a tie scores nothing for them. Doubled, the higher
//   side takes all, times two (times four redoubled).
// - Points become game points by tens (a suit rounds up from 6, All Trumps
//   from 4, No Trumps from 5). The first team to 151 wins.
import {
  ACE,
  JACK,
  KING,
  QUEEN,
  Rng,
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

export const SEATS = 4;
export const TARGET = 151;
export const CONTRACTS = ["clubs", "diamonds", "hearts", "spades", "no", "all"] as const;
export type Contract = (typeof CONTRACTS)[number];
export const teamOf = (seat: number): 0 | 1 => (seat % 2 === 0 ? 0 : 1);
/** Counter-clockwise: the next player is on your right. */
export const nextSeat = (seat: number) => (seat + 3) % SEATS;

export interface Play {
  seat: number;
  card: Card;
}

export interface Declaration {
  seat: number;
  kind: "tierce" | "quarte" | "quinte" | "carre" | "belote";
  points: number;
  /** For sequences: the length and top rank (to compare); for carrés, the rank. */
  rank: number;
  length: number;
  /** False when the other team had a better sequence. */
  counts: boolean;
}

export interface State {
  hands: Card[][];
  /** Undealt cards (the last three each after bidding). */
  stock: Card[];
  phase: "bid" | "play";
  dealer: number;
  turn: number;
  contract: { kind: Contract; seat: number; doubled: 0 | 1 | 2 } | null;
  /** Calls this round, in order, for showing. */
  calls: { seat: number; call: Call }[];
  /** Passes in a row. */
  passes: number;
  trick: Play[];
  lastTrick: { plays: Play[]; winner: number } | null;
  /** Card points each team has taken this deal. */
  taken: [number, number];
  tricksWon: [number, number];
  declarations: Declaration[];
  /** Seats that have announced belote this deal (one per suit in All Trumps). */
  belotes: string[];
  scores: [number, number];
  lastDeal: { points: [number, number]; inside: boolean } | null;
  deals: number;
  moves: number;
  rng: RngState;
}

export type Call = { bid: Contract } | { pass: true } | { double: true } | { redouble: true };
export type Action = Call | { play: Card };

const TRUMP_ORDER = [7, 8, QUEEN, KING, 10, ACE, 9, JACK];
const PLAIN_ORDER = [7, 8, 9, JACK, QUEEN, KING, 10, ACE];
const TRUMP_POINTS: Record<number, number> = {
  [JACK]: 20,
  9: 14,
  [ACE]: 11,
  10: 10,
  [KING]: 4,
  [QUEEN]: 3,
};
const PLAIN_POINTS: Record<number, number> = {
  [ACE]: 11,
  10: 10,
  [KING]: 4,
  [QUEEN]: 3,
  [JACK]: 2,
};

export const isTrump = (contract: Contract | undefined, c: Card): boolean =>
  contract === "all" || (contract !== undefined && contract !== "no" && suitOf(c) === contract);

export function strength(contract: Contract | undefined, c: Card): number {
  return (isTrump(contract, c) ? TRUMP_ORDER : PLAIN_ORDER).indexOf(rankOf(c));
}

export function cardPoints(contract: Contract | undefined, c: Card): number {
  const p = isTrump(contract, c) ? TRUMP_POINTS[rankOf(c)] : PLAIN_POINTS[rankOf(c)];
  return (p ?? 0) * (contract === "no" ? 2 : 1);
}

function deal(base: Omit<State, "hands" | "stock" | "rng">, rng: Rng): State {
  const deck = shuffledDeck(rng, 32);
  return {
    ...base,
    hands: Array.from({ length: SEATS }, (_, s) => sortHand(deck.slice(s * 5, s * 5 + 5))),
    stock: deck.slice(20),
    phase: "bid",
    turn: nextSeat(base.dealer),
    contract: null,
    calls: [],
    passes: 0,
    trick: [],
    taken: [0, 0],
    tricksWon: [0, 0],
    declarations: [],
    belotes: [],
    rng: rng.state,
  };
}

function initialState(_config: unknown, _seats: number, seed: string): State {
  return deal(
    {
      phase: "bid",
      dealer: 0,
      turn: 3,
      contract: null,
      calls: [],
      passes: 0,
      trick: [],
      lastTrick: null,
      taken: [0, 0],
      tricksWon: [0, 0],
      declarations: [],
      belotes: [],
      scores: [0, 0],
      lastDeal: null,
      deals: 0,
      moves: 0,
    },
    Rng.fromSeed(seed),
  );
}

const over = (state: State) =>
  state.phase === "bid" &&
  state.calls.length === 0 &&
  (state.scores[0] >= TARGET || state.scores[1] >= TARGET) &&
  state.scores[0] !== state.scores[1];

export function legalCalls(state: State, seat: number): Call[] {
  const calls: Call[] = [{ pass: true }];
  const current = state.contract;
  const from = current ? CONTRACTS.indexOf(current.kind) + 1 : 0;
  for (const kind of CONTRACTS.slice(from)) calls.push({ bid: kind });
  if (current && teamOf(current.seat) !== teamOf(seat) && current.doubled === 0)
    calls.push({ double: true });
  if (current && teamOf(current.seat) === teamOf(seat) && current.doubled === 1)
    calls.push({ redouble: true });
  return calls;
}

/** The cards `seat` may play now, by the strict Bulgarian rules. */
export function playable(state: State, seat: number): Card[] {
  const hand = state.hands[seat] ?? [];
  const kind = state.contract?.kind;
  const led = state.trick[0];
  if (!led) return hand;
  const ledSuit = suitOf(led.card);
  const follow = hand.filter((c) => suitOf(c) === ledSuit);
  const winning = trickWinner(state.trick, kind);
  const best = state.trick.find((p) => p.seat === winning)?.card ?? led.card;
  if (follow.length > 0) {
    // Raise in a trump suit (a trump lead, or any suit in All Trumps).
    if (isTrump(kind, led.card)) {
      const higher = follow.filter((c) =>
        isTrump(kind, best) && suitOf(best) === ledSuit
          ? strength(kind, c) > strength(kind, best)
          : true,
      );
      return higher.length > 0 ? higher : follow;
    }
    return follow;
  }
  if (kind === "no" || kind === "all") return hand;
  // A suit contract and nothing to follow with: trump, unless the partner is winning.
  if (teamOf(winning) === teamOf(seat) && winning !== seat) return hand;
  const trumps = hand.filter((c) => isTrump(kind, c));
  if (trumps.length === 0) return hand;
  const over = isTrump(kind, best)
    ? trumps.filter((c) => strength(kind, c) > strength(kind, best))
    : trumps;
  return over.length > 0 ? over : trumps;
}

export function trickWinner(plays: readonly Play[], kind: Contract | undefined): number {
  const led = plays[0];
  if (!led) return 0;
  let best = led;
  for (const p of plays) {
    const bTrump = isTrump(kind, best.card) && kind !== "all";
    const pTrump = isTrump(kind, p.card) && kind !== "all";
    if (pTrump && !bTrump) best = p;
    else if (
      suitOf(p.card) === suitOf(best.card) &&
      strength(kind, p.card) > strength(kind, best.card)
    )
      best = p;
  }
  return best.seat;
}

/** Sequences (3+ in a row, by the 7–A order) and carrés in a full hand. */
export function declarationsOf(hand: readonly Card[], seat: number): Declaration[] {
  const out: Declaration[] = [];
  const RUN = [7, 8, 9, 10, JACK, QUEEN, KING, ACE];
  for (const suit of ["clubs", "diamonds", "hearts", "spades"] as const) {
    const has = RUN.map((r) => hand.some((c) => suitOf(c) === suit && rankOf(c) === r));
    let i = 0;
    while (i < RUN.length) {
      if (!has[i]) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < RUN.length && has[j + 1]) j++;
      const length = j - i + 1;
      if (length >= 3) {
        const kind = length === 3 ? "tierce" : length === 4 ? "quarte" : "quinte";
        out.push({
          seat,
          kind,
          points: length === 3 ? 20 : length === 4 ? 50 : 100,
          rank: RUN[j] ?? 0,
          length,
          counts: true,
        });
      }
      i = j + 1;
    }
  }
  for (const r of [JACK, 9, ACE, KING, QUEEN, 10]) {
    if (hand.filter((c) => rankOf(c) === r).length === 4) {
      out.push({
        seat,
        kind: "carre",
        points: r === JACK ? 200 : r === 9 ? 150 : 100,
        rank: r,
        length: 4,
        counts: true,
      });
    }
  }
  return out;
}

/** Only the team with the best sequence scores its sequences; a tie cancels both. */
function settleSequences(decls: Declaration[]): Declaration[] {
  const seqs = decls.filter((d) => d.kind !== "carre" && d.kind !== "belote");
  const better = (a: Declaration, b: Declaration) => a.length - b.length || a.rank - b.rank;
  let best: Declaration | null = null;
  let tie = false;
  for (const d of seqs) {
    if (!best || better(d, best) > 0) {
      best = d;
      tie = false;
    } else if (better(d, best) === 0 && teamOf(d.seat) !== teamOf(best.seat)) tie = true;
  }
  return decls.map((d) =>
    d.kind === "carre" || d.kind === "belote"
      ? d
      : { ...d, counts: best !== null && !tie && teamOf(d.seat) === teamOf(best.seat) },
  );
}

function roundGame(points: number, kind: Contract): number {
  const up = kind === "all" ? 4 : kind === "no" ? 5 : 6;
  return Math.floor(points / 10) + (points % 10 >= up ? 1 : 0);
}

function legalActions(state: State, seat: number): Action[] {
  if (over(state) || seat !== state.turn) return [];
  if (state.phase === "bid") return legalCalls(state, seat);
  return playable(state, seat).map((c) => ({ play: c }));
}

const sameCall = (a: Action, b: Action) =>
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

function newDeal(state: State, points: [number, number] | null, inside: boolean): State {
  return deal(
    {
      ...state,
      scores: points ? [state.scores[0] + points[0], state.scores[1] + points[1]] : state.scores,
      lastDeal: points ? { points, inside } : state.lastDeal,
      dealer: nextSeat(state.dealer),
      deals: state.deals + 1,
      lastTrick: points ? state.lastTrick : null,
    },
    new Rng(state.rng),
  );
}

function applyAction(state: State, seat: number, action: Action): State {
  if (!legalActions(state, seat).some((a) => sameCall(a, action))) return state;
  const moves = state.moves + 1;
  if (!("play" in action)) {
    const calls = [...state.calls, { seat, call: action }];
    let { contract } = state;
    let passes = state.passes;
    if ("pass" in action) passes++;
    else {
      passes = 0;
      if ("bid" in action) contract = { kind: action.bid, seat, doubled: 0 };
      else if (contract) contract = { ...contract, doubled: "double" in action ? 1 : 2 };
    }
    // All Trumps redoubled: nothing can follow.
    const closed = contract?.kind === "all" && contract.doubled === 2;
    if (!contract && passes === 4) return { ...newDeal(state, null, false), moves };
    if (contract && (passes === 3 || closed)) {
      // Bidding is over: three more cards each, then declarations.
      const hands = state.hands.map((h, i) =>
        sortHand([...h, ...state.stock.slice(i * 3, i * 3 + 3)]),
      );
      const decls =
        contract.kind === "no"
          ? []
          : settleSequences(hands.flatMap((h, i) => declarationsOf(h, i)));
      return {
        ...state,
        hands,
        stock: [],
        phase: "play",
        contract,
        calls,
        passes,
        turn: nextSeat(state.dealer),
        declarations: decls,
        moves,
      };
    }
    return { ...state, contract, calls, passes, turn: nextSeat(seat), moves };
  }
  const kind = state.contract?.kind;
  const card = action.play;
  const hand = state.hands[seat] ?? [];
  // Belote: the king or queen of trumps, with the other still in hand.
  const belotes = [...state.belotes];
  const declarations = [...state.declarations];
  const r = rankOf(card);
  const suit: Suit = suitOf(card);
  const beloteSuit =
    kind &&
    kind !== "no" &&
    (r === KING || r === QUEEN) &&
    (kind !== "all" ? suit === kind : !state.trick[0] || suitOf(state.trick[0].card) === suit);
  if (
    beloteSuit &&
    !belotes.includes(suit) &&
    hand.some((c) => suitOf(c) === suit && rankOf(c) === (r === KING ? QUEEN : KING))
  ) {
    belotes.push(suit);
    declarations.push({ seat, kind: "belote", points: 20, rank: 0, length: 2, counts: true });
  }
  const hands = state.hands.map((h, i) => (i === seat ? h.filter((c) => c !== card) : h));
  const trick = [...state.trick, { seat, card }];
  if (trick.length < SEATS)
    return { ...state, hands, trick, belotes, declarations, turn: nextSeat(seat), moves };
  const winner = trickWinner(trick, kind);
  const team = teamOf(winner);
  const last = hands.every((h) => h.length === 0);
  const won =
    trick.reduce((n, p) => n + cardPoints(kind, p.card), 0) +
    (last ? 10 * (kind === "no" ? 2 : 1) : 0);
  const taken: [number, number] = [...state.taken];
  taken[team] += won;
  const tricksWon: [number, number] = [...state.tricksWon];
  tricksWon[team] += 1;
  const next: State = {
    ...state,
    hands,
    trick: [],
    lastTrick: { plays: trick, winner },
    taken,
    tricksWon,
    belotes,
    declarations,
    turn: winner,
    moves,
  };
  if (!last || !state.contract) return next;
  // The deal is over: who made it, and the game points.
  const bidders = teamOf(state.contract.seat);
  const raw: [number, number] = [...taken];
  for (const d of declarations) if (d.counts) raw[teamOf(d.seat)] += d.points;
  for (const t of [0, 1] as const) if (tricksWon[t] === 8) raw[t] += 90;
  const mult = state.contract.doubled === 2 ? 4 : state.contract.doubled === 1 ? 2 : 1;
  const others = bidders === 0 ? 1 : 0;
  const final: [number, number] = [0, 0];
  let inside = false;
  if (mult > 1) {
    const winnerTeam = raw[bidders] > raw[others] ? bidders : others;
    inside = winnerTeam !== bidders;
    final[winnerTeam] = (raw[0] + raw[1]) * mult;
  } else if (raw[bidders] > raw[others]) {
    final[0] = raw[0];
    final[1] = raw[1];
  } else if (raw[bidders] < raw[others]) {
    inside = true;
    final[others] = raw[0] + raw[1];
  } else {
    final[others] = raw[others];
  }
  const points: [number, number] = [
    roundGame(final[0], state.contract.kind),
    roundGame(final[1], state.contract.kind),
  ];
  return { ...newDeal(next, points, inside), moves };
}

function currentSeats(state: State): number[] {
  return over(state) ? [] : [state.turn];
}

function result(state: State): GameResult | null {
  if (!over(state)) return null;
  const winner = state.scores[0] > state.scores[1] ? 0 : 1;
  return { completed: true, outcome: [0, 1, 2, 3].map((s) => (teamOf(s) === winner ? 1 : 0)) };
}

/** Other hands, the stock and the Rng are secret; calls and declarations are said aloud. */
function view(state: State, seat: number | null): State {
  return {
    ...state,
    hands: state.hands.map((h, i) => (i === seat ? h : hideCards(h))),
    stock: hideCards(state.stock),
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

/** Bots' helper: a suit's name as a contract. */
export const SUIT_CONTRACTS: readonly Suit[] = ["clubs", "diamonds", "hearts", "spades"];
