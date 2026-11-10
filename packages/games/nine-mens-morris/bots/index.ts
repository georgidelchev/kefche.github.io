// Nine Men's Morris bots (SPEC §9.5). Easy takes a mill when it sees one and
// otherwise often plays anywhere. Medium searches three plies on pieces and
// mills; hard searches as deep as its budget allows and also counts mobility,
// blocked pieces and lines one piece short of a mill.
import { searchBestAction, type Bot, type GameBots, type SearchProblem } from "@kefche/game-sdk";

import { ADJACENT, countOf, EMPTY, engine, MILLS, type Action, type State } from "../engine";

const material = (state: State, seat: number) =>
  100 *
  (countOf(state.board, seat) +
    (state.inHand[seat] ?? 0) -
    countOf(state.board, 1 - seat) -
    (state.inHand[1 - seat] ?? 0));

function lines(state: State, seat: number): number {
  let score = 0;
  for (const mill of MILLS) {
    let own = 0;
    let theirs = 0;
    for (const p of mill) {
      if (state.board[p] === seat) own++;
      else if (state.board[p] !== EMPTY) theirs++;
    }
    if (own === 3) score += 12;
    else if (own === 2 && theirs === 0) score += 6;
    if (theirs === 3) score -= 12;
    else if (theirs === 2 && own === 0) score -= 6;
  }
  return score;
}

function mobility(state: State, seat: number): number {
  let free = 0;
  let blocked = 0;
  state.board.forEach((v, p) => {
    if (v === EMPTY) return;
    const moves = (ADJACENT[p] ?? []).filter((q) => state.board[q] === EMPTY).length;
    const sign = v === seat ? 1 : -1;
    free += sign * moves;
    if (moves === 0) blocked += sign;
  });
  return 3 * free - 8 * blocked;
}

const evaluateHard = (state: State, seat: number) =>
  material(state, seat) + lines(state, seat) + mobility(state, seat);

/** Removals first, then moves into lines. */
const order = (_state: State, actions: Action[]) =>
  actions.toSorted((a, b) => Number(b.remove !== null) - Number(a.remove !== null));

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
    const mills = actions.filter((a) => a.remove !== null);
    if (mills.length > 0 && rng.next() < 0.8) return rng.pick(mills);
    return rng.pick(actions);
  },
};

export const bots: GameBots<State, Action> = {
  easy,
  medium: searchBot(3, (state, seat) => material(state, seat) + lines(state, seat)),
  hard: searchBot(64, evaluateHard),
};
