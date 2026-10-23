// Game-tree search for board-game bots (SPEC §9.5): iterative-deepening
// alpha-beta against a deadline. With more than two players it runs
// "paranoid" search: every other seat is treated as one opponent minimizing
// the bot's value. Extra turns need no special case, because each node asks
// the engine whose turn it is.

import type { TurnEngine } from "./engines";
import type { Rng } from "./prng";

export interface SearchProblem<State, Action> {
  engine: Pick<
    TurnEngine<State, Action, unknown>,
    "legalActions" | "applyAction" | "currentSeats" | "result"
  >;
  /** Heuristic value of a running game for `seat`; higher is better. Keep it well inside ±WIN_SCORE. */
  evaluate(state: State, seat: number): number;
  /** Actions best-first for `seat`. Good ordering makes the search much deeper. */
  order?(state: State, actions: Action[], seat: number): Action[];
}

export interface SearchLimits {
  /** Deepest ply to try; the deadline usually stops the search first. */
  maxDepth: number;
  deadline: number;
  now: () => number;
}

export interface SearchResult<Action> {
  action: Action;
  /** Value for the searching seat; ±WIN_SCORE (minus plies) is a forced result. */
  score: number;
  /** Deepest fully searched ply; 0 when even depth 1 ran out of time. */
  depth: number;
  nodes: number;
}

export const WIN_SCORE = 1_000_000;
/** Scores this close to ±WIN_SCORE are forced wins or losses. */
const FORCED = WIN_SCORE - 10_000;

class OutOfTime extends Error {}

export function searchBestAction<State, Action>(
  problem: SearchProblem<State, Action>,
  state: State,
  seat: number,
  limits: SearchLimits,
  rng: Rng,
): SearchResult<Action> {
  const { engine } = problem;
  const order = (s: State, actions: Action[], mover: number) =>
    problem.order ? problem.order(s, actions, mover) : actions;
  // Shuffled first, so equally good moves vary between games (sorting is stable).
  let ordered = order(state, rng.shuffle(engine.legalActions(state, seat)), seat);
  const first = ordered[0];
  if (first === undefined) throw new RangeError("searchBestAction: no legal actions");

  let nodes = 0;
  /** Positions cut off by the depth limit; none in a pass means the whole tree was searched. */
  let horizonHits = 0;
  let iteration = 0;
  const value = (s: State, depth: number, alpha: number, beta: number, ply: number): number => {
    const checkTime = (++nodes & 1023) === 0 && iteration > 1;
    if (checkTime && limits.now() > limits.deadline) throw new OutOfTime();
    const result = engine.result(s);
    if (result) {
      const v = ((result.outcome?.[seat] ?? 0.5) - 0.5) * 2 * WIN_SCORE;
      // Prefer quick wins and slow losses.
      return v > 0 ? v - ply : v < 0 ? v + ply : 0;
    }
    const mover = engine.currentSeats(s)[0];
    const actions = mover === undefined ? [] : engine.legalActions(s, mover);
    if (depth === 0 || mover === undefined || actions.length === 0) {
      horizonHits++;
      return problem.evaluate(s, seat);
    }
    const maximizing = mover === seat;
    let best = maximizing ? -Infinity : Infinity;
    for (const action of order(s, actions, mover)) {
      const v = value(engine.applyAction(s, mover, action), depth - 1, alpha, beta, ply + 1);
      if (maximizing) {
        best = Math.max(best, v);
        alpha = Math.max(alpha, v);
      } else {
        best = Math.min(best, v);
        beta = Math.min(beta, v);
      }
      if (alpha >= beta) break;
    }
    return best;
  };

  let found: SearchResult<Action> = { action: first, score: 0, depth: 0, nodes: 0 };
  for (let depth = 1; depth <= limits.maxDepth; depth++) {
    iteration = depth;
    const hitsBefore = horizonHits;
    try {
      let alpha = -Infinity;
      let bestAction: Action = first;
      let bestScore = -Infinity;
      for (const action of ordered) {
        // Depth 1 always finishes, so there is an answer even with no time left.
        if (iteration > 1 && limits.now() > limits.deadline) throw new OutOfTime();
        const v = value(engine.applyAction(state, seat, action), depth - 1, alpha, Infinity, 1);
        if (v > bestScore) {
          bestScore = v;
          bestAction = action;
        }
        alpha = Math.max(alpha, v);
      }
      found = { action: bestAction, score: bestScore, depth, nodes };
      // The best move goes first in the next, deeper pass.
      ordered = [bestAction, ...ordered.filter((a) => a !== bestAction)];
    } catch (e) {
      if (e instanceof OutOfTime) break;
      throw e;
    }
    // A forced result, or the whole tree fits in this depth: deeper adds nothing.
    if (Math.abs(found.score) >= FORCED || horizonHits === hitsBefore) break;
  }
  return { ...found, nodes };
}
