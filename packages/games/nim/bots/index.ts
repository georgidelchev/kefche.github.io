// Nim bots (SPEC §9.5). With two players, Nim is solved: hard always plays
// the move that leaves a nim-sum of zero (in misère, it switches strategy
// when only piles of one are left), medium does so most of the time, and
// easy plays at random but takes a win it can see. With three or more
// players there is no such formula, so hard and medium search the game tree
// ("paranoid": everyone else against the bot) within their budget.
import { searchBestAction, type Bot, type GameBots, type Rng } from "@kefche/game-sdk";

import { engine, nimSum, total, type Action, type State } from "../engine";

/** The perfect two-player move, or null when every move loses against perfect play. */
function perfect(state: State): Action | null {
  const { piles, misere } = state;
  const big = piles.filter((p) => p > 1).length;
  if (misere && big <= 1) {
    // Endgame: leave an odd number of single piles.
    const ones = piles.filter((p) => p === 1).length;
    if (big === 0) {
      // Only ones: take one from any pile; you win if an odd number are left after.
      return ones % 2 === 0 ? { pile: piles.indexOf(1), take: 1 } : null;
    }
    const pile = piles.findIndex((p) => p > 1);
    const size = piles[pile] ?? 0;
    // Leave the big pile at 0 or 1 so that the ones left are odd.
    return { pile, take: ones % 2 === 0 ? size - 1 : size };
  }
  const x = nimSum(piles);
  if (x === 0) return null;
  const pile = piles.findIndex((p) => (p ^ x) < p);
  const size = piles[pile] ?? 0;
  return { pile, take: size - (size ^ x) };
}

/** A move that ends the game in your favour now, if there is one (normal play: the last pile). */
function obviousWin(state: State): Action | null {
  const left = state.piles.filter((p) => p > 0);
  if (!state.misere && left.length === 1)
    return { pile: state.piles.findIndex((p) => p > 0), take: left[0] ?? 1 };
  return null;
}

const randomMove = (state: State, seat: number, rng: Rng) =>
  rng.pick(engine.legalActions(state, seat));

const bot = (level: "easy" | "medium" | "hard"): Bot<State, Action> => ({
  choose(state, seat, { rng, deadline, now }) {
    const win = obviousWin(state);
    if (win) return win;
    if (level === "easy") return randomMove(state, seat, rng);
    if (state.seats === 2) {
      if (level === "medium" && rng.next() < 0.3) return randomMove(state, seat, rng);
      return perfect(state) ?? { pile: state.piles.indexOf(Math.max(...state.piles)), take: 1 };
    }
    // Three or more players: search; terminal results decide, nothing else does.
    const maxDepth = level === "hard" ? 64 : 3;
    const problem = { engine, evaluate: () => 0 };
    if (total(state.piles) > 24 && level === "medium") return randomMove(state, seat, rng);
    return searchBestAction(problem, state, seat, { maxDepth, deadline, now }, rng).action;
  },
});

export const bots: GameBots<State, Action> = {
  easy: bot("easy"),
  medium: bot("medium"),
  hard: bot("hard"),
};
