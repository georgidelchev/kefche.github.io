// Spades bots (SPEC §9.5: rule-based, with a feel for the odds). They see
// only their own hand (a view), and the bids, which are public.
// - Bidding: aces count one, guarded kings and queens part of one, and
//   spades beyond three, or short side suits with spades to trump them, add
//   more. A hand worth almost nothing bids nil. Easy guesses loosely.
// - Medium: when its partner is winning the trick it plays low; when the
//   team still needs tricks it wins as cheaply as it can, otherwise it ducks.
// - Hard: also avoids taking tricks once the team has made its bid (bags),
//   and covers a partner's nil by winning tricks the partner might take.
import {
  ACE,
  KING,
  QUEEN,
  rankOf,
  suitOf,
  type Bot,
  type Card,
  type GameBots,
} from "@kefche/game-sdk";

import { engine, playable, teamOf, trickWinner, type Action, type State } from "../engine";

export function estimate(hand: readonly Card[]): number {
  let tricks = 0;
  const bySuit = (s: string) => hand.filter((c) => suitOf(c) === s);
  for (const suit of ["clubs", "diamonds", "hearts", "spades"] as const) {
    const cards = bySuit(suit);
    for (const c of cards) {
      const r = rankOf(c);
      if (r === ACE) tricks += 1;
      else if (r === KING && cards.length >= 2) tricks += 0.75;
      else if (r === QUEEN && cards.length >= 3) tricks += 0.35;
    }
    if (suit === "spades") tricks += Math.max(0, cards.length - 3) * 0.8;
    else if (cards.length <= 1 && bySuit("spades").length >= 3) tricks += 0.6 * (2 - cards.length);
  }
  return tricks;
}

function bid(state: State, seat: number, loose: number): number {
  const hand = state.hands[seat] ?? [];
  const value = estimate(hand) + loose;
  const highSpade = hand.some((c) => suitOf(c) === "spades" && rankOf(c) >= QUEEN);
  if (value < 0.9 && !highSpade && loose === 0) return 0;
  return Math.max(1, Math.min(13, Math.round(value)));
}

const low = (cs: readonly Card[]) =>
  cs.reduce((a, b) =>
    rankOf(b) + (suitOf(b) === "spades" ? 13 : 0) < rankOf(a) + (suitOf(a) === "spades" ? 13 : 0)
      ? b
      : a,
  );
const high = (cs: readonly Card[]) =>
  cs.reduce((a, b) =>
    rankOf(b) + (suitOf(b) === "spades" ? 13 : 0) > rankOf(a) + (suitOf(a) === "spades" ? 13 : 0)
      ? b
      : a,
  );

function choose(state: State, seat: number, hard: boolean): Card {
  const options = playable(state, seat);
  const partner = (seat + 2) % 4;
  const team = teamOf(seat);
  const teamBid = [seat, partner].reduce((n, s) => n + (state.bids[s] ?? 0), 0);
  const teamTricks = [seat, partner].reduce((n, s) => n + (state.tricks[s] ?? 0), 0);
  const needTricks = teamTricks < teamBid;
  const myNil = state.bids[seat] === 0;
  const partnerNil = state.bids[partner] === 0;
  const winners = options.filter((c) => trickWinner([...state.trick, { seat, card: c }]) === seat);
  const losers = options.filter((c) => !winners.includes(c));
  if (state.trick.length === 0) {
    if (myNil) return low(options);
    return needTricks ? high(options) : low(options);
  }
  const current = trickWinner(state.trick);
  if (myNil) return losers.length > 0 ? high(losers) : low(options);
  if (hard && partnerNil && current === partner && winners.length > 0) return low(winners);
  if (current === partner && !partnerNil) return losers.length > 0 ? low(losers) : low(options);
  if ((needTricks || (!hard && teamOf(current) !== team)) && winners.length > 0)
    return low(winners);
  return losers.length > 0 ? (hard ? high(losers) : low(losers)) : low(options);
}

const thinker = (hard: boolean): Bot<State, Action> => ({
  choose(state, seat) {
    if (state.phase === "bid") return { bid: bid(state, seat, 0) };
    return { play: choose(state, seat, hard) };
  },
});

const easy: Bot<State, Action> = {
  choose(state, seat, { rng }) {
    if (state.phase === "bid") return { bid: bid(state, seat, rng.int(-1, 1)) };
    return rng.pick(engine.legalActions(state, seat));
  },
};

export const bots: GameBots<State, Action> = { easy, medium: thinker(false), hard: thinker(true) };
