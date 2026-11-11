// Gin Rummy bots (SPEC §9.5: rule-based, with a feel for the odds). They
// see their own hand and the discard pile (a view).
// - Easy: takes the discard only when it makes a meld, discards its highest
//   deadwood card, and knocks as soon as it may.
// - Medium: takes the discard when it lowers its deadwood, discards to keep
//   the least deadwood (the higher card on a tie), and knocks when it may.
// - Hard: also keeps cards next to the ones the other player has taken from
//   the pile out of the discard, and waits for gin when it's close and the
//   stock is still long.
import { suitOf, type Bot, type Card, type GameBots } from "@kefche/game-sdk";

import { bestMelds, deadValue, engine, low, type Action, type State } from "../engine";

function bestDiscard(hand: readonly Card[], avoid: (c: Card) => boolean, taken: Card | null) {
  let best: { card: Card; points: number } | null = null;
  for (const c of hand) {
    if (c === taken) continue;
    const points = bestMelds(hand.filter((x) => x !== c)).points + (avoid(c) ? 3 : 0);
    if (
      !best ||
      points < best.points ||
      (points === best.points && deadValue(c) > deadValue(best.card))
    ) {
      best = { card: c, points };
    }
  }
  return best;
}

const thinker = (hard: boolean, loose: boolean): Bot<State, Action> => ({
  choose(state, seat) {
    const me = seat as 0 | 1;
    const hand = state.hands[me];
    if (state.phase === "draw") {
      const top = state.discard.at(-1);
      if (top === undefined) return { draw: "stock" };
      const now = bestMelds(hand).points;
      const withIt = bestDiscard([...hand, top], () => false, top)?.points ?? now;
      const better = loose
        ? bestMelds([...hand, top]).melds.some((m) => m.includes(top))
        : withIt < now;
      return { draw: better ? "discard" : "stock" };
    }
    // Cards the other player picked up from the pile: don't feed them neighbours.
    const wanted = state.pickups[me === 0 ? 1 : 0];
    const avoid = (c: Card) =>
      hard &&
      wanted.some(
        (w) => (suitOf(w) === suitOf(c) && Math.abs(low(w) - low(c)) === 1) || low(w) === low(c),
      );
    const pick = bestDiscard(hand, avoid, state.taken);
    const card = pick?.card ?? hand[0] ?? 0;
    const rest = bestMelds(hand.filter((x) => x !== card)).points;
    const mayKnock = engine.legalActions(state, seat).some((a) => "knock" in a && a.knock === card);
    const waitForGin = hard && rest > 0 && rest <= 4 && state.stock.length > 14;
    if (mayKnock && !waitForGin) return { knock: card };
    return { discard: card };
  },
});

export const bots: GameBots<State, Action> = {
  easy: thinker(false, true),
  medium: thinker(false, false),
  hard: thinker(true, false),
};
