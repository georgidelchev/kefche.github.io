// Go bots (SPEC §9.5): Monte Carlo tree search (UCT) with random playouts
// that never fill their own eyes, for as long as the budget allows. Easy
// often plays a random point instead; medium and hard differ in thinking
// time (400 and 900 ms). Each bot passes when it has nothing but its own eyes
// to fill, or when the other side has passed and the count favours it, and
// always accepts the count while scoring.
import type { Bot, BotContext, GameBots } from "@kefche/game-sdk";

import { EMPTY, estimateDead, FastBoard, KOMI, scoreOf, type Action, type State } from "../engine";

const PASS = -1;
const EXPLORE = 1.1;

interface Node {
  move: number;
  /** Who plays next from this node. */
  toPlay: number;
  visits: number;
  /** Playouts won by the player who made `move`. */
  wins: number;
  children: Node[];
  untried: number[] | null;
}

const node = (move: number, toPlay: number): Node => ({
  move,
  toPlay,
  visits: 0,
  wins: 0,
  children: [],
  untried: null,
});

/** Points `colour` may play that aren't its own eyes. */
function candidates(b: FastBoard, colour: number): number[] {
  const out: number[] = [];
  for (let p = 0; p < b.cells.length; p++) {
    if (b.cells[p] === EMPTY && !b.isEye(p, colour) && b.isLegal(p, colour)) out.push(p);
  }
  return out;
}

function search(state: State, seat: number, { rng, deadline, now }: BotContext): number {
  const random = () => rng.next();
  const root = node(PASS, seat);
  const base = new FastBoard(state.size, state.board);
  base.ko = state.ko;
  const maxMoves = state.size * state.size * 3;
  let iterations = 0;
  // At least a few hundred playouts, so a slow device still plays sensibly.
  while (iterations < 300 || now() < deadline) {
    if (iterations > 50_000) break;
    iterations++;
    const b = base.clone();
    let current = root;
    const path = [root];
    // Selection: down fully expanded nodes by UCB1.
    while (
      current.untried !== null &&
      current.untried.length === 0 &&
      current.children.length > 0
    ) {
      const log = Math.log(current.visits);
      let best = current.children[0] ?? current;
      let bestValue = -Infinity;
      for (const child of current.children) {
        const value =
          child.wins / (child.visits || 1) + EXPLORE * Math.sqrt(log / (child.visits || 1));
        if (value > bestValue) {
          bestValue = value;
          best = child;
        }
      }
      if (best.move === PASS) b.ko = -1;
      else b.play(best.move, current.toPlay);
      current = best;
      path.push(current);
    }
    // Expansion: one untried move.
    if (current.untried === null) {
      const moves = candidates(b, current.toPlay);
      current.untried = moves.length > 0 ? rng.shuffle(moves) : [PASS];
    }
    const move = current.untried.pop();
    if (move !== undefined) {
      if (move === PASS) b.ko = -1;
      else b.play(move, current.toPlay);
      const child = node(move, 1 - current.toPlay);
      current.children.push(child);
      current = child;
      path.push(child);
    }
    // A random game from here, scored by area with the komi.
    const [black, white] = b.playout(current.toPlay, random, maxMoves);
    const winner = black - white > KOMI ? 0 : 1;
    for (const n of path) {
      n.visits++;
      if (winner === 1 - n.toPlay) n.wins++;
    }
  }
  let chosen = root.children[0];
  for (const child of root.children) if (!chosen || child.visits > chosen.visits) chosen = child;
  return chosen?.move ?? PASS;
}

const mcts = (mistakes: number): Bot<State, Action> => ({
  choose(state, seat, context) {
    if (state.phase === "scoring") return { type: "accept" };
    const b = new FastBoard(state.size, state.board);
    b.ko = state.ko;
    const moves = candidates(b, seat);
    if (moves.length === 0) return { type: "pass" };
    // The other side passed: pass too if the count as it stands wins.
    if (state.passes === 1) {
      const { total } = scoreOf(state, estimateDead(state));
      if ((total[seat] ?? 0) > (total[1 - seat] ?? 0)) return { type: "pass" };
    }
    if (context.rng.next() < mistakes) return { type: "play", point: context.rng.pick(moves) };
    const point = search(state, seat, context);
    return point === PASS ? { type: "pass" } : { type: "play", point };
  },
});

export const bots: GameBots<State, Action> = {
  easy: mcts(0.35),
  medium: mcts(0),
  hard: mcts(0),
};
