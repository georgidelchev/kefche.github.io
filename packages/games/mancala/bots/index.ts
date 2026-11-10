// Mancala bots (SPEC §9.5). Easy likes extra turns and captures but often
// plays any pit. Medium searches four plies on the stores; hard searches as
// deep as its budget allows (extra turns included, which the search handles
// because each node asks the engine whose turn it is), also valuing the
// seeds on its own side.
import { searchBestAction, type Bot, type GameBots, type SearchProblem } from "@kefche/game-sdk";

import { engine, pitsOf, score, STORE, type Action, type State } from "../engine";

const stores = (state: State, seat: number) => score(state, seat) - score(state, 1 - seat);
const side = (state: State, seat: number) =>
  pitsOf(seat).reduce((n, p) => n + (state.holes[p] ?? 0), 0);
const evaluateHard = (state: State, seat: number) =>
  4 * stores(state, seat) + (side(state, seat) - side(state, 1 - seat));

/** Pits whose last seed lands in the store first, then the rest from the far end. */
function order(state: State, actions: Action[], seat: number): Action[] {
  const store = STORE[seat === 0 ? 0 : 1];
  const lands = (a: Action) => (a.pit + (state.holes[a.pit] ?? 0)) % 13 === store;
  return actions.toSorted((a, b) => Number(lands(b)) - Number(lands(a)) || b.pit - a.pit);
}

const searchBot = (
  maxDepth: number,
  evaluate: SearchProblem<State, Action>["evaluate"],
): Bot<State, Action> => {
  const problem: SearchProblem<State, Action> = { engine, evaluate, order };
  return {
    choose(state, seat, { rng, deadline, now }) {
      return searchBestAction(problem, state, seat, { maxDepth, deadline, now }, rng).action;
    },
  };
};

const easy: Bot<State, Action> = {
  choose(state, seat, { rng }) {
    const actions = engine.legalActions(state, seat);
    if (rng.next() < 0.5) {
      const gain = (a: Action) => {
        const next = engine.applyAction(state, seat, a);
        return score(next, seat) - score(state, seat) + (next.last?.again ? 2 : 0);
      };
      const best = Math.max(...actions.map(gain));
      return rng.pick(actions.filter((a) => gain(a) === best));
    }
    return rng.pick(actions);
  },
};

export const bots: GameBots<State, Action> = {
  easy,
  medium: searchBot(4, stores),
  hard: searchBot(64, evaluateHard),
};
