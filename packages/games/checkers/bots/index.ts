// Checkers bots (SPEC §9.5). Easy takes the biggest capture and otherwise
// often plays anywhere. Medium searches four plies on material. Hard searches
// as deep as its budget allows, valuing material, kings, men close to being
// crowned, the centre and a guarded back row.
import { searchBestAction, type Bot, type GameBots, type SearchProblem } from "@kefche/game-sdk";

import { EMPTY, engine, isKing, seatOf, type Action, type State } from "../engine";

const MAN = 100;
/** A flying king is worth about three men. */
const KING = 300;

function material(state: State, seat: number): number {
  let score = 0;
  for (const piece of state.board) {
    if (piece === EMPTY) continue;
    const value = isKing(piece) ? KING : MAN;
    score += seatOf(piece) === seat ? value : -value;
  }
  return score;
}

function positional(state: State, seat: number): number {
  const { board, size } = state;
  let score = material(state, seat);
  const middle = (size - 1) / 2;
  board.forEach((piece, square) => {
    if (piece === EMPTY) return;
    const row = Math.floor(square / size);
    const col = square % size;
    const own = seatOf(piece) === seat ? 1 : -1;
    if (isKing(piece)) {
      // Kings on the long diagonals see the most of the board.
      score += own * (row === col || row + col === size - 1 ? 8 : 0);
      return;
    }
    // Men: how far they've come, how central they stand, and the back row held.
    const advance = seatOf(piece) === 0 ? size - 1 - row : row;
    const centre = middle - Math.abs(col - middle);
    const back = advance === 0 ? 6 : 0;
    score += own * (advance * 3 + centre * 2 + back);
  });
  return score;
}

/** Longer captures first, then moves that end nearer the far row. */
function order(state: State, actions: Action[], seat: number): Action[] {
  const { size } = state;
  const rank = (a: Action) => {
    const end = a.path.at(-1) ?? 0;
    const row = Math.floor(end / size);
    return a.path.length * 100 + (seat === 0 ? size - row : row);
  };
  return actions.toSorted((a, b) => rank(b) - rank(a));
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
    if (rng.next() < 0.6) {
      const longest = Math.max(...actions.map((a) => a.path.length));
      return rng.pick(actions.filter((a) => a.path.length === longest));
    }
    return rng.pick(actions);
  },
};

export const bots: GameBots<State, Action> = {
  easy,
  medium: searchBot(4, material),
  hard: searchBot(64, positional),
};
