// Ultimate Tic-Tac-Toe bots (SPEC §9.5). Classic tic-tac-toe is solved: hard
// searches it to the end and never loses, medium does so most of the time,
// easy plays at random but takes a win. Ultimate: Monte Carlo tree search
// (UCT) with random playouts for as long as the budget allows; easy also
// plays a random cell a third of the time. Every bot takes a win it sees.
import { searchBestAction, type Bot, type BotContext, type GameBots } from "@kefche/game-sdk";

import { engine, lineOf, movesFor, type Action, type State } from "../engine";

const EXPLORE = 1.2;

interface Node {
  cell: number;
  toPlay: number;
  visits: number;
  wins: number;
  children: Node[];
  untried: number[] | null;
}

const node = (cell: number, toPlay: number): Node => ({
  cell,
  toPlay,
  visits: 0,
  wins: 0,
  children: [],
  untried: null,
});

function playout(state: State, rng: BotContext["rng"]): number | null {
  let s = state;
  while (!s.over) {
    const moves = movesFor(s);
    s = engine.applyAction(s, s.turn, { cell: rng.pick(moves) });
  }
  return s.winner;
}

function mcts(state: State, seat: number, { rng, deadline, now }: BotContext): number {
  const root = node(-1, seat);
  let rounds = 0;
  while (rounds < 200 || now() < deadline) {
    if (rounds > 100_000) break;
    rounds++;
    let s = state;
    let current = root;
    const path = [root];
    while (
      current.untried !== null &&
      current.untried.length === 0 &&
      current.children.length > 0
    ) {
      const log = Math.log(current.visits);
      let best = current.children[0] ?? current;
      let bestValue = -Infinity;
      for (const child of current.children) {
        const v = child.wins / (child.visits || 1) + EXPLORE * Math.sqrt(log / (child.visits || 1));
        if (v > bestValue) {
          bestValue = v;
          best = child;
        }
      }
      s = engine.applyAction(s, current.toPlay, { cell: best.cell });
      current = best;
      path.push(current);
    }
    current.untried ??= s.over ? [] : rng.shuffle(movesFor(s));
    const cell = current.untried.pop();
    if (cell !== undefined) {
      s = engine.applyAction(s, current.toPlay, { cell });
      const child = node(cell, 1 - current.toPlay);
      current.children.push(child);
      path.push(child);
    }
    const winner = playout(s, rng);
    for (const n of path) {
      n.visits++;
      // A win for the player who moved into the node, half for a draw.
      if (winner === 1 - n.toPlay) n.wins++;
      else if (winner === null) n.wins += 0.5;
    }
  }
  let chosen = root.children[0];
  for (const child of root.children) if (!chosen || child.visits > chosen.visits) chosen = child;
  return chosen?.cell ?? movesFor(state)[0] ?? 0;
}

/** A move that wins at once, if there is one. */
function winning(state: State, seat: number): number | null {
  for (const cell of movesFor(state)) {
    if (engine.applyAction(state, seat, { cell }).winner === seat) return cell;
  }
  return null;
}

const classicProblem = { engine, evaluate: () => 0 };

const bot = (level: "easy" | "medium" | "hard"): Bot<State, Action> => ({
  choose(state, seat, context) {
    const { rng, deadline, now } = context;
    const win = winning(state, seat);
    if (win !== null) return { cell: win };
    const moves = movesFor(state);
    if (state.mode === "classic") {
      // Medium and hard always stop the other player's line.
      const block = moves.find((c) => {
        const cells = state.cells.slice();
        cells[c] = 1 - seat;
        return lineOf(cells, 1 - seat) !== null;
      });
      if (block !== undefined && level !== "easy") return { cell: block };
      if (level === "easy" || (level === "medium" && rng.next() < 0.3))
        return { cell: rng.pick(moves) };
      return searchBestAction(classicProblem, state, seat, { maxDepth: 9, deadline, now }, rng)
        .action;
    }
    if (level === "easy" && rng.next() < 0.35) return { cell: rng.pick(moves) };
    return { cell: mcts(state, seat, context) };
  },
});

export const bots: GameBots<State, Action> = {
  easy: bot("easy"),
  medium: bot("medium"),
  hard: bot("hard"),
};
