// Santase bots (SPEC §9.5: rule-based, with a feel for the odds). They see
// their own hand, the trump card, the trick and the points (a view).
// - Easy: any card it may play.
// - Medium: leads a marriage when it has one and swaps the nine of trumps;
//   otherwise leads its least valuable card. Following, it takes an ace or
//   ten with the cheapest card that wins, and otherwise throws the cheapest.
// - Hard: also closes the stock when its points and trumps should carry it
//   to 66, and trumps high cards while the stock is open.
import { KING, QUEEN, rankOf, suitOf, type Bot, type Card, type GameBots } from "@kefche/game-sdk";

import { beats, engine, playable, strength, value, type Action, type State } from "../engine";

const cheapest = (state: State, cs: readonly Card[]) =>
  cs.reduce((a, b) => {
    const va = value(a) * 10 + strength(a) + (suitOf(a) === state.trump ? 100 : 0);
    const vb = value(b) * 10 + strength(b) + (suitOf(b) === state.trump ? 100 : 0);
    return vb < va ? b : a;
  });

function marriage(state: State, hand: readonly Card[]): Card | null {
  for (const c of hand) {
    if (rankOf(c) !== KING && rankOf(c) !== QUEEN) continue;
    const mate = rankOf(c) === KING ? QUEEN : KING;
    if (
      hand.some((x) => suitOf(x) === suitOf(c) && rankOf(x) === mate) &&
      !state.marriages.some((m) => m.suit === suitOf(c))
    ) {
      return c;
    }
  }
  return null;
}

const thinker = (hard: boolean): Bot<State, Action> => ({
  choose(state, seat) {
    const me = seat as 0 | 1;
    const hand = state.hands[me];
    const actions = engine.legalActions(state, seat);
    const options = playable(state, seat);
    if (state.trick.length === 0) {
      if (actions.some((a) => "exchange" in a)) return { exchange: true };
      const m = marriage(state, hand);
      if (m !== null) return { play: m };
      if (hard && actions.some((a) => "close" in a)) {
        const trumps = hand.filter((c) => suitOf(c) === state.trump);
        const strong = trumps.filter((c) => strength(c) >= 4).length;
        if (state.points[me] >= 40 && strong >= 2) return { close: true };
      }
      return { play: cheapest(state, options) };
    }
    const led = state.trick[0]?.card ?? 0;
    const winners = options.filter((c) => beats(state, c, led));
    const worth = value(led);
    const open = state.closed === null && state.stock.length > 0;
    if (winners.length > 0 && (worth >= 10 || !open || (hard && worth >= 4))) {
      // Win cheaply; while the stock is open, don't spend a trump on little.
      const plain = winners.filter((c) => suitOf(c) !== state.trump);
      return { play: cheapest(state, plain.length > 0 ? plain : winners) };
    }
    return { play: cheapest(state, options) };
  },
});

const easy: Bot<State, Action> = {
  choose(state, seat, { rng }) {
    const plays = engine.legalActions(state, seat).filter((a) => "play" in a);
    return rng.pick(plays);
  },
};

export const bots: GameBots<State, Action> = { easy, medium: thinker(false), hard: thinker(true) };
