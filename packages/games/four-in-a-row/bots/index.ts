// Four in a Row bots (SPEC §9.5). Easy plays loosely: it always takes a win,
// usually blocks one, and otherwise leans to the centre. Medium searches four
// plies; hard searches as deep as its time allows. Both score positions by
// open lines of four, with three-player and four-player games searched
// "paranoid" (everyone else against the bot).
import { searchBestAction, type Bot, type GameBots, type SearchProblem } from "@kefche/game-sdk";

import { engine, isOver, winsWith, WIN_LENGTH, type Action, type State } from "../engine";

/** Every line of four cells on a board, cached per size. */
const windowCache = new Map<string, number[][]>();
function windows(cols: number, rows: number): number[][] {
  const key = `${String(cols)}x${String(rows)}`;
  const cached = windowCache.get(key);
  if (cached) return cached;
  const found: number[][] = [];
  for (const [dc, dr] of [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ] as const) {
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const endC = c + dc * (WIN_LENGTH - 1);
        const endR = r + dr * (WIN_LENGTH - 1);
        if (endC < 0 || endC >= cols || endR < 0 || endR >= rows) continue;
        found.push(
          Array.from({ length: WIN_LENGTH }, (_, k) => (c + dc * k) * rows + (r + dr * k)),
        );
      }
    }
  }
  windowCache.set(key, found);
  return found;
}

/** Value of a line holding n discs of one player and nothing else. */
const LINE_VALUE = [0, 1, 6, 40, 0];

/** Open lines for `seat` minus open lines for everyone else, plus the centre. */
export function evaluate(state: State, seat: number): number {
  let score = 0;
  for (const line of windows(state.cols, state.rows)) {
    let owner = -1;
    let count = 0;
    let dead = false;
    for (const cell of line) {
      const v = state.cells[cell] ?? -1;
      if (v === -1) continue;
      if (owner === -1) owner = v;
      else if (v !== owner) {
        dead = true;
        break;
      }
      count++;
    }
    if (dead || owner === -1) continue;
    const value = LINE_VALUE[count] ?? 0;
    // Threats against the bot weigh a little more: it moves only once per round.
    score += owner === seat ? value : -value * 1.15;
  }
  const centre = (state.cols - 1) / 2;
  for (let c = 0; c < state.cols; c++) {
    const weight = 3 - Math.min(3, Math.abs(c - centre));
    for (let r = 0; r < (state.heights[c] ?? 0); r++) {
      const v = state.cells[c * state.rows + r];
      if (v === seat) score += weight;
      else if (v !== undefined && v !== -1) score -= weight;
    }
  }
  return score;
}

/** Winning drops first, then blocks of the next seat's win, then centre-out. */
function order(state: State, actions: Action[], seat: number): Action[] {
  const centre = (state.cols - 1) / 2;
  const next = (seat + 1) % state.seats;
  const rank = ({ column }: Action) =>
    winsWith(state, column, seat)
      ? -100
      : winsWith(state, column, next)
        ? -50
        : Math.abs(column - centre);
  return actions.toSorted((a, b) => rank(a) - rank(b));
}

const problem: SearchProblem<State, Action> = { engine, evaluate, order };

const searchBot = (maxDepth: number): Bot<State, Action> => ({
  choose(state, seat, { rng, deadline, now }) {
    return searchBestAction(problem, state, seat, { maxDepth, deadline, now }, rng).action;
  },
});

const easy: Bot<State, Action> = {
  choose(state, seat, { rng }) {
    const actions = engine.legalActions(state, seat);
    const win = actions.find((a) => winsWith(state, a.column, seat));
    if (win) return win;
    const next = (seat + 1) % state.seats;
    const block = actions.find((a) => winsWith(state, a.column, next));
    if (block && rng.next() < 0.7) return block;
    // Avoid giving the next player a win on top of this disc, most of the time.
    const safe = actions.filter((a) => {
      const after = engine.applyAction(state, seat, a);
      return isOver(after) || !winsWith(after, a.column, next);
    });
    const pool = safe.length > 0 && rng.next() < 0.6 ? safe : actions;
    // Lean towards the centre: weight 1–4 by distance.
    const centre = (state.cols - 1) / 2;
    const weighted = pool.flatMap((a) =>
      Array.from({ length: Math.max(1, 4 - Math.round(Math.abs(a.column - centre))) }, () => a),
    );
    return rng.pick(weighted);
  },
};

export const bots: GameBots<State, Action> = {
  easy,
  medium: searchBot(4),
  hard: searchBot(64),
};
