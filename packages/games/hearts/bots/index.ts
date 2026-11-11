// Hearts bots (SPEC §9.5: rule-based, with a feel for the odds). They see
// only their own hand (a view).
// - Easy: passes and plays at random among what's allowed.
// - Medium: passes its most dangerous cards (the queen, ace and king of
//   spades, high hearts, then high cards of short suits); ducks under the
//   card winning the trick when it can, and when it can't follow, dumps the
//   queen of spades or its highest heart.
// - Hard: also leads spades to drive out the queen when it doesn't hold it
//   or anything above it, and takes a trick with no points in it when it's
//   last to play (getting rid of a high card for free).
import { ACE, KING, rankOf, suitOf, type Bot, type Card, type GameBots } from "@kefche/game-sdk";

import { QUEEN_OF_SPADES, engine, playable, points, type Action, type State } from "../engine";

function danger(c: Card, hand: readonly Card[]): number {
  if (c === QUEEN_OF_SPADES) return 100;
  const r = rankOf(c);
  const suit = suitOf(c);
  if (suit === "spades") return r > 12 ? 60 + r : r;
  const length = hand.filter((x) => suitOf(x) === suit).length;
  if (suit === "hearts") return 20 + r * 2;
  // A short suit is worth emptying: it lets you dump points later.
  return r + (length <= 3 ? 12 : 0);
}

function passThree(state: State, seat: number): Action {
  const hand = state.hands[seat] ?? [];
  const pick = [...hand].sort((a, b) => danger(b, hand) - danger(a, hand)).slice(0, 3);
  return { pass: pick.sort((a, b) => a - b) };
}

/** The card winning the trick so far (null when leading). */
function winning(state: State): Card | null {
  const led = state.trick[0];
  if (!led) return null;
  let best = led.card;
  for (const p of state.trick) {
    if (suitOf(p.card) === suitOf(led.card) && rankOf(p.card) > rankOf(best)) best = p.card;
  }
  return best;
}

function choosePlay(state: State, seat: number, hard: boolean): Card {
  const options = playable(state, seat);
  const hand = state.hands[seat] ?? [];
  const low = (cs: readonly Card[]) => cs.reduce((a, b) => (rankOf(b) < rankOf(a) ? b : a));
  const high = (cs: readonly Card[]) => cs.reduce((a, b) => (rankOf(b) > rankOf(a) ? b : a));
  const best = winning(state);
  if (best === null) {
    // Leading: drive out the queen of spades if it's safe to, else lead low, hearts last.
    if (hard) {
      const spades = options.filter((c) => suitOf(c) === "spades" && rankOf(c) < 12);
      const holdsTop = hand.some((c) => suitOf(c) === "spades" && rankOf(c) >= 12);
      if (spades.length > 0 && !holdsTop) return low(spades);
    }
    const safe = options.filter((c) => suitOf(c) !== "hearts" && c !== QUEEN_OF_SPADES);
    return low(safe.length > 0 ? safe : options);
  }
  const led = state.trick[0]?.card ?? best;
  const following = options.every((c) => suitOf(c) === suitOf(led));
  if (following) {
    const under = options.filter((c) => rankOf(c) < rankOf(best));
    const pointsIn = state.trick.some((p) => points(p.card) > 0);
    const last = state.trick.length === 3;
    if (hard && last && !pointsIn && !options.includes(QUEEN_OF_SPADES)) return high(options);
    if (under.length > 0) return high(under);
    // Can't duck: if last, take it with the highest; otherwise the lowest that still wins.
    const safe = options.filter((c) => c !== QUEEN_OF_SPADES);
    return last ? high(safe.length > 0 ? safe : options) : low(options);
  }
  // Void in the suit led: get rid of trouble.
  if (options.includes(QUEEN_OF_SPADES)) return QUEEN_OF_SPADES;
  const bigSpades = options.filter((c) => suitOf(c) === "spades" && rankOf(c) >= KING);
  if (bigSpades.length > 0 && rankOf(high(bigSpades)) <= ACE) return high(bigSpades);
  const hearts = options.filter((c) => suitOf(c) === "hearts");
  return high(hearts.length > 0 ? hearts : options);
}

const thinker = (hard: boolean): Bot<State, Action> => ({
  choose(state, seat) {
    if (state.phase === "pass") return passThree(state, seat);
    return { play: choosePlay(state, seat, hard) };
  },
});

const easy: Bot<State, Action> = {
  choose(state, seat, { rng }) {
    if (state.phase === "pass") {
      return {
        pass: rng
          .shuffle(state.hands[seat] ?? [])
          .slice(0, 3)
          .sort((a, b) => a - b),
      };
    }
    return rng.pick(engine.legalActions(state, seat));
  },
};

export const bots: GameBots<State, Action> = {
  easy,
  medium: thinker(false),
  hard: thinker(true),
};
