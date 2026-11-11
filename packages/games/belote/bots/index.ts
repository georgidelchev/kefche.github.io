// Belote bots (SPEC §9.5: rule-based, with a feel for the odds). They see
// only their own hand (a view), the calls and the declarations.
// - Bidding: each contract is valued from the five cards held: in a suit,
//   its jack and nine and their companions, plus side aces; in No Trumps,
//   aces and guarded tens; in All Trumps, jacks and nines. A bot bids the
//   best contract worth it that's higher than the current one. Easy bids
//   loosely; hard also doubles a contract it holds the cards to beat.
// - Play: lead strong cards (trumps when the team bid them); when the
//   partner is winning, give points; otherwise win as cheaply as possible
//   when the trick is worth it, else play the cheapest card.
import { ACE, JACK, rankOf, suitOf, type Bot, type Card, type GameBots } from "@kefche/game-sdk";

import {
  CONTRACTS,
  SUIT_CONTRACTS,
  cardPoints,
  engine,
  legalCalls,
  playable,
  strength,
  teamOf,
  trickWinner,
  type Action,
  type Contract,
  type State,
} from "../engine";

export function value(hand: readonly Card[], kind: Contract): number {
  let v = 0;
  for (const c of hand) {
    const r = rankOf(c);
    if (kind === "no")
      v +=
        r === ACE
          ? 2.2
          : r === 10 && hand.some((x) => suitOf(x) === suitOf(c) && rankOf(x) === ACE)
            ? 1.2
            : 0;
    else if (kind === "all") v += r === JACK ? 2.4 : r === 9 ? 1.5 : r === ACE ? 0.6 : 0;
    else if (suitOf(c) === kind) v += r === JACK ? 2.5 : r === 9 ? 1.8 : r === ACE ? 1.1 : 0.7;
    else v += r === ACE ? 1 : 0;
  }
  return v;
}

const THRESHOLD: Record<Contract, number> = {
  clubs: 5,
  diamonds: 5,
  hearts: 5,
  spades: 5,
  no: 5.5,
  all: 6.5,
};

function call(state: State, seat: number, loose: number, doubles: boolean): Action {
  const hand = state.hands[seat] ?? [];
  const options = legalCalls(state, seat);
  if (doubles && options.some((o) => "double" in o) && state.contract) {
    const theirs = state.contract.kind;
    if (theirs !== "no" && value(hand, theirs) >= 5) return { double: true };
  }
  // A partner's bid stands unless this hand is much better somewhere else.
  const partnerBid = state.contract && teamOf(state.contract.seat) === teamOf(seat);
  let best: { kind: Contract; score: number } | null = null;
  for (const o of options) {
    if (!("bid" in o)) continue;
    const score = value(hand, o.bid) + loose - THRESHOLD[o.bid] - (partnerBid ? 1.5 : 0);
    if (score >= 0 && (!best || score > best.score)) best = { kind: o.bid, score };
  }
  return best ? { bid: best.kind } : { pass: true };
}

function choosePlay(state: State, seat: number): Card {
  const options = playable(state, seat);
  const kind = state.contract?.kind;
  const cheap = (cs: readonly Card[]) =>
    cs.reduce((a, b) =>
      cardPoints(kind, b) * 10 + strength(kind, b) < cardPoints(kind, a) * 10 + strength(kind, a)
        ? b
        : a,
    );
  const rich = (cs: readonly Card[]) =>
    cs.reduce((a, b) => (cardPoints(kind, b) > cardPoints(kind, a) ? b : a));
  const strongest = (cs: readonly Card[]) =>
    cs.reduce((a, b) => (strength(kind, b) > strength(kind, a) ? b : a));
  if (state.trick.length === 0) {
    const bidders = state.contract && teamOf(state.contract.seat) === teamOf(seat);
    const trumps = options.filter(
      (c) => kind && kind !== "no" && kind !== "all" && suitOf(c) === kind,
    );
    if (bidders && trumps.length > 0 && trumps.some((c) => rankOf(c) === JACK))
      return strongest(trumps);
    const aces = options.filter((c) => rankOf(c) === ACE && (kind === "no" || suitOf(c) !== kind));
    if (aces.length > 0) return aces[0] ?? options[0] ?? 0;
    return cheap(options);
  }
  const winning = trickWinner(state.trick, kind);
  if (teamOf(winning) === teamOf(seat)) {
    const safe = options.filter(
      (c) => trickWinner([...state.trick, { seat, card: c }], kind) === winning,
    );
    return safe.length > 0 ? rich(safe) : cheap(options);
  }
  const winners = options.filter(
    (c) => trickWinner([...state.trick, { seat, card: c }], kind) === seat,
  );
  const worth = state.trick.reduce((n, p) => n + cardPoints(kind, p.card), 0);
  if (winners.length > 0 && (worth >= 10 || state.trick.length === 3)) return cheap(winners);
  return cheap(options);
}

const thinker = (doubles: boolean): Bot<State, Action> => ({
  choose(state, seat) {
    if (state.phase === "bid") return call(state, seat, 0, doubles);
    return { play: choosePlay(state, seat) };
  },
});

const easy: Bot<State, Action> = {
  choose(state, seat, { rng }) {
    if (state.phase === "bid") return call(state, seat, rng.next() * 2 - 1, false);
    return rng.pick(engine.legalActions(state, seat));
  },
};

export const bots: GameBots<State, Action> = { easy, medium: thinker(false), hard: thinker(true) };

/** Every contract, for the bid buttons. */
export const ALL_CONTRACTS = CONTRACTS;
export const SUITS_ONLY = SUIT_CONTRACTS;
