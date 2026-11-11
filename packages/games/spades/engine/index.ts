// Spades (SPEC §20.2 #14): four players in two partnerships (seats 0 and 2
// against 1 and 3), 13 cards each, spades always trumps.
// - Bidding: from the dealer's left, each player bids the tricks they expect
//   to take, 1–13, or nil (0: to take none).
// - Play: the dealer's left leads; follow suit if you can; a spade beats
//   any other suit. Spades can't be led until one has been played (unless
//   you hold only spades).
// - Scoring per team: making the bid scores 10 a trick bid plus 1 a trick
//   over (a "bag"); falling short loses 10 a trick bid. A nil scores 100,
//   or loses 100 if that player takes a trick (those tricks are bags for the
//   team and don't count toward the partner's bid). Every 10 bags cost 100.
// - The first team to 500 (or 300) wins, the higher if both get there; a
//   team down to −200 loses.
import {
  Rng,
  hideCards,
  rankOf,
  shuffledDeck,
  sortHand,
  suitOf,
  type Card,
  type GameResult,
  type RngState,
  type TurnEngine,
} from "@kefche/game-sdk";

export interface Config {
  target: 500 | 300;
}

export function configFrom(raw: unknown): Config {
  return { target: (raw as { target?: unknown } | undefined)?.target === 300 ? 300 : 500 };
}

export const SEATS = 4;
export const MERCY = -200;
export const teamOf = (seat: number): 0 | 1 => (seat % 2 === 0 ? 0 : 1);

export interface Play {
  seat: number;
  card: Card;
}

export interface State {
  hands: Card[][];
  phase: "bid" | "play";
  dealer: number;
  /** Each seat's bid this hand (0 is nil), null until made. */
  bids: (number | null)[];
  turn: number;
  trick: Play[];
  lastTrick: { plays: Play[]; winner: number } | null;
  /** Tricks each seat has taken this hand. */
  tricks: number[];
  spadesBroken: boolean;
  /** Per team. */
  scores: [number, number];
  bags: [number, number];
  /** Each team's points from the last hand, for showing. */
  lastHand: [number, number] | null;
  target: number;
  moves: number;
  rng: RngState;
}

export type Action = { bid: number } | { play: Card };

function deal(state: Omit<State, "hands" | "rng">, rng: Rng): State {
  const deck = shuffledDeck(rng, 52);
  return {
    ...state,
    hands: Array.from({ length: SEATS }, (_, s) => sortHand(deck.slice(s * 13, s * 13 + 13))),
    phase: "bid",
    bids: [null, null, null, null],
    turn: (state.dealer + 1) % SEATS,
    trick: [],
    tricks: [0, 0, 0, 0],
    spadesBroken: false,
    rng: rng.state,
  };
}

function initialState(config: Config, _seats: number, seed: string): State {
  return deal(
    {
      phase: "bid",
      dealer: 0,
      bids: [],
      turn: 1,
      trick: [],
      lastTrick: null,
      tricks: [],
      spadesBroken: false,
      scores: [0, 0],
      bags: [0, 0],
      lastHand: null,
      target: config.target,
      moves: 0,
    },
    Rng.fromSeed(seed),
  );
}

/** The cards `seat` may play now. */
export function playable(state: State, seat: number): Card[] {
  const hand = state.hands[seat] ?? [];
  const led = state.trick[0];
  if (!led) {
    const others = hand.filter((c) => suitOf(c) !== "spades");
    return state.spadesBroken || others.length === 0 ? hand : others;
  }
  const follow = hand.filter((c) => suitOf(c) === suitOf(led.card));
  return follow.length > 0 ? follow : hand;
}

export function trickWinner(plays: readonly Play[]): number {
  const led = plays[0];
  if (!led) return 0;
  let best = led;
  for (const p of plays) {
    const trumps = suitOf(p.card) === "spades";
    const bestTrumps = suitOf(best.card) === "spades";
    if (trumps && !bestTrumps) best = p;
    else if (suitOf(p.card) === suitOf(best.card) && rankOf(p.card) > rankOf(best.card)) best = p;
  }
  return best.seat;
}

export function over(state: State): boolean {
  if (state.phase !== "bid" || state.bids.some((b) => b !== null)) return false;
  const [a, b] = state.scores;
  return a <= MERCY || b <= MERCY || ((a >= state.target || b >= state.target) && a !== b);
}

function legalActions(state: State, seat: number): Action[] {
  if (over(state) || seat !== state.turn) return [];
  if (state.phase === "bid") return Array.from({ length: 14 }, (_, n) => ({ bid: n }));
  return playable(state, seat).map((c) => ({ play: c }));
}

/** A hand's points for each team, and the bags it adds. */
export function handScore(state: State): { points: [number, number]; bags: [number, number] } {
  const points: [number, number] = [0, 0];
  const bags: [number, number] = [0, 0];
  for (const team of [0, 1] as const) {
    const seats = [team, team + 2];
    let bid = 0;
    let taken = 0;
    for (const s of seats) {
      const b = state.bids[s] ?? 0;
      const t = state.tricks[s] ?? 0;
      if (b === 0) {
        points[team] += t === 0 ? 100 : -100;
        bags[team] += t;
      } else {
        bid += b;
        taken += t;
      }
    }
    if (bid > 0) {
      if (taken >= bid) {
        points[team] += bid * 10 + (taken - bid);
        bags[team] += taken - bid;
      } else points[team] -= bid * 10;
    }
  }
  return { points, bags };
}

function applyAction(state: State, seat: number, action: Action): State {
  if (
    !legalActions(state, seat).some((a) =>
      "bid" in a && "bid" in action
        ? a.bid === action.bid
        : "play" in a && "play" in action && a.play === action.play,
    )
  ) {
    return state;
  }
  const moves = state.moves + 1;
  if ("bid" in action) {
    const bids = state.bids.map((b, i) => (i === seat ? action.bid : b));
    const done = bids.every((b) => b !== null);
    return {
      ...state,
      bids,
      phase: done ? "play" : "bid",
      turn: done ? (state.dealer + 1) % SEATS : (seat + 1) % SEATS,
      moves,
    };
  }
  const hands = state.hands.map((h, i) => (i === seat ? h.filter((c) => c !== action.play) : h));
  const trick = [...state.trick, { seat, card: action.play }];
  const spadesBroken = state.spadesBroken || suitOf(action.play) === "spades";
  if (trick.length < SEATS)
    return { ...state, hands, trick, spadesBroken, turn: (seat + 1) % SEATS, moves };
  const winner = trickWinner(trick);
  const tricks = state.tricks.map((t, i) => (i === winner ? t + 1 : t));
  const next: State = {
    ...state,
    hands,
    trick: [],
    lastTrick: { plays: trick, winner },
    spadesBroken,
    tricks,
    turn: winner,
    moves,
  };
  if (hands.some((h) => h.length > 0)) return next;
  // The hand is over: score it, then the next deal.
  const { points, bags } = handScore(next);
  const scores: [number, number] = [state.scores[0] + points[0], state.scores[1] + points[1]];
  const bagged: [number, number] = [state.bags[0] + bags[0], state.bags[1] + bags[1]];
  for (const team of [0, 1] as const) {
    while (bagged[team] >= 10) {
      bagged[team] -= 10;
      scores[team] -= 100;
    }
  }
  return deal(
    { ...next, scores, bags: bagged, lastHand: points, dealer: (state.dealer + 1) % SEATS },
    new Rng(state.rng),
  );
}

function currentSeats(state: State): number[] {
  return over(state) ? [] : [state.turn];
}

function result(state: State): GameResult | null {
  if (!over(state)) return null;
  const [a, b] = state.scores;
  const winner = a <= MERCY ? 1 : b <= MERCY ? 0 : a > b ? 0 : 1;
  return { completed: true, outcome: [0, 1, 2, 3].map((s) => (teamOf(s) === winner ? 1 : 0)) };
}

/** Other hands are secret, and so is the Rng. Bids are said out loud. */
function view(state: State, seat: number | null): State {
  return {
    ...state,
    hands: state.hands.map((h, i) => (i === seat ? h : hideCards(h))),
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
