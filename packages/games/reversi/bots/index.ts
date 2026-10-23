// Reversi bots (SPEC §9.5). Easy is greedy with mistakes: it grabs corners
// and big flips, but often just plays anywhere. Medium searches three plies
// with square weights. Hard adds mobility (how many moves each side has) and
// searches as deep as its budget allows, which near the end of the game is
// the whole remaining tree: an exact endgame solve.
import { searchBestAction, type Bot, type GameBots, type SearchProblem } from "@kefche/game-sdk";

import { engine, flipsFor, movesFor, SIZE, type Action, type State } from "../engine";

// Classic square weights: corners are gold, the squares next to them are
// dangerous while the corner is still empty.
// prettier-ignore
const WEIGHTS = [
  100, -20, 10,  5,  5, 10, -20, 100,
  -20, -50, -2, -2, -2, -2, -50, -20,
   10,  -2,  1,  1,  1,  1,  -2,  10,
    5,  -2,  1,  0,  0,  1,  -2,   5,
    5,  -2,  1,  0,  0,  1,  -2,   5,
   10,  -2,  1,  1,  1,  1,  -2,  10,
  -20, -50, -2, -2, -2, -2, -50, -20,
  100, -20, 10,  5,  5, 10, -20, 100,
];

/** For each corner: the C- and X-squares next to it. */
const CORNERS: readonly [number, readonly number[]][] = [
  [0, [1, 8, 9]],
  [7, [6, 15, 14]],
  [56, [57, 48, 49]],
  [63, [62, 55, 54]],
];

/** Square weights, with the squares next to a taken corner no longer risky. */
function weights(board: readonly number[]): number[] {
  const w = WEIGHTS.slice();
  for (const [corner, near] of CORNERS) {
    if (board[corner] === -1) continue;
    for (const square of near) w[square] = 5;
  }
  return w;
}

function positional(board: readonly number[], seat: number): number {
  const w = weights(board);
  let score = 0;
  for (let square = 0; square < SIZE * SIZE; square++) {
    const v = board[square];
    if (v === seat) score += w[square] ?? 0;
    else if (v !== -1) score -= w[square] ?? 0;
  }
  return score;
}

const evaluateHard = (state: State, seat: number) =>
  positional(state.board, seat) +
  8 * (movesFor(state.board, seat).length - movesFor(state.board, 1 - seat).length);

/** Corners first, then by square weight. */
function order(state: State, actions: Action[]): Action[] {
  const w = weights(state.board);
  return actions.toSorted((a, b) => (w[b.square] ?? 0) - (w[a.square] ?? 0));
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
    const corner = actions.find((a) => CORNERS.some(([c]) => c === a.square));
    if (corner && rng.next() < 0.8) return corner;
    if (rng.next() < 0.5) {
      const flips = (a: Action) => flipsFor(state.board, a.square, seat).length;
      const most = Math.max(...actions.map(flips));
      return rng.pick(actions.filter((a) => flips(a) === most));
    }
    return rng.pick(actions);
  },
};

export const bots: GameBots<State, Action> = {
  easy,
  medium: searchBot(3, (state, seat) => positional(state.board, seat)),
  hard: searchBot(64, evaluateHard),
};
