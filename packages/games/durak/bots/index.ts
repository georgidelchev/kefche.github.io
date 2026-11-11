// Durak bots (SPEC §9.5: rule-based, with a feel for the odds). They see
// their own hand, the table, the trump card and how many cards are left.
// - Easy: any card it may play; it takes now and then rather than beat.
// - Medium: attacks with its lowest non-trump; beats with the cheapest card
//   that does (a plain card before a trump); throws in low cards only.
// - Hard: also takes rather than spend a high trump early on a cheap card,
//   keeps trumps and high cards back while the deck is long, and transfers
//   when it can.
import { rankOf, suitOf, type Bot, type Card, type GameBots } from "@kefche/game-sdk";

import { engine, type Action, type State } from "../engine";

const cost = (state: State, c: Card) => rankOf(c) + (suitOf(c) === state.trump ? 20 : 0);
const cheapest = (state: State, cs: readonly Card[]) =>
  cs.reduce((a, b) => (cost(state, b) < cost(state, a) ? b : a));

const thinker = (hard: boolean): Bot<State, Action> => ({
  choose(state, seat) {
    const actions = engine.legalActions(state, seat);
    const cards = (key: "attack" | "beat" | "add" | "transfer") =>
      actions.flatMap((a) => (key in a ? [(a as Record<string, Card>)[key] ?? 0] : []));
    if (state.phase === "attack") return { attack: cheapest(state, cards("attack")) };
    if (state.phase === "defend") {
      const transfers = cards("transfer");
      if (hard && transfers.length > 0) {
        const t = cheapest(state, transfers);
        if (suitOf(t) !== state.trump) return { transfer: t };
      }
      const beats = cards("beat");
      if (beats.length === 0) return { take: true };
      const best = cheapest(state, beats);
      const deckLong = state.deck.length > 8;
      const open = state.table.find((p) => p.defense === null);
      if (
        hard &&
        deckLong &&
        open &&
        suitOf(best) === state.trump &&
        rankOf(best) >= 12 &&
        rankOf(open.attack) < 10
      ) {
        return { take: true };
      }
      return { beat: best };
    }
    const adds = cards("add");
    const deckLong = state.deck.length > 6;
    const low = adds.filter(
      (c) => suitOf(c) !== state.trump && (!deckLong || rankOf(c) <= (hard ? 10 : 11)),
    );
    if (low.length > 0) return { add: cheapest(state, low) };
    if (!deckLong && adds.length > 0 && hard) return { add: cheapest(state, adds) };
    return { pass: true };
  },
});

const easy: Bot<State, Action> = {
  choose(state, seat, { rng }) {
    const actions = engine.legalActions(state, seat);
    if (state.phase === "defend" && rng.next() < 0.15) return { take: true };
    const plays = actions.filter((a) => !("take" in a));
    return rng.pick(plays.length > 0 ? plays : actions);
  },
};

export const bots: GameBots<State, Action> = { easy, medium: thinker(false), hard: thinker(true) };
