// Shape Claim bots (SPEC §9.5): greedy placement. Each placement is scored
// by its size (cells now), the corners it opens for the bot (room to grow)
// and the corners it takes away from the others. Easy places a large piece
// at random most of the time; medium weighs size and its own room; hard also
// blocks the others' room. The weights were tuned in self-play.
import type { Bot, GameBots } from "@kefche/game-sdk";

import { EMPTY, engine, fits, placements, type Action, type State } from "../engine";

export interface Weights {
  size: number;
  room: number;
  block: number;
}

/** Empty cells where `seat` could reach next: its corners. */
function corners(state: State, seat: number): number {
  let n = 0;
  for (let cell = 0; cell < state.board.length; cell++) {
    if (state.board[cell] === EMPTY && fits(state, seat, [cell])) n++;
  }
  return n;
}

function value(state: State, seat: number, slot: number, cells: number[], w: Weights): number {
  const after = engine.applyAction(state, seat, { type: "place", slot, cells });
  let score = w.size * cells.length + w.room * corners(after, seat);
  if (w.block > 0) {
    for (let o = 0; o < state.seats; o++) {
      if (o !== seat) score -= w.block * (corners(state, o) - corners(after, o));
    }
  }
  return score;
}

export const greedy = (w: Weights): Bot<State, Action> => ({
  choose(state, seat, { rng, deadline, now }) {
    const options = state.row.flatMap((_, slot) =>
      placements(state, seat, slot).map((cells) => ({ slot, cells })),
    );
    if (options.length === 0) return { type: "pass" };
    // The biggest pieces first, so a short budget still sees them.
    const ordered = rng.shuffle(options).toSorted((a, b) => b.cells.length - a.cells.length);
    let best = ordered[0];
    let bestValue = -Infinity;
    for (const o of ordered) {
      if (now() > deadline) break;
      const v = value(state, seat, o.slot, o.cells, w);
      if (v > bestValue) {
        bestValue = v;
        best = o;
      }
    }
    return best ? { type: "place", slot: best.slot, cells: best.cells } : { type: "pass" };
  },
});

const easy: Bot<State, Action> = {
  choose(state, seat, { rng }) {
    const options = state.row.flatMap((_, slot) =>
      placements(state, seat, slot).map((cells) => ({ slot, cells })),
    );
    if (options.length === 0) return { type: "pass" };
    const biggest = Math.max(...options.map((o) => o.cells.length));
    const pool = rng.next() < 0.7 ? options.filter((o) => o.cells.length === biggest) : options;
    const pick = rng.pick(pool);
    return { type: "place", slot: pick.slot, cells: pick.cells };
  },
};

export const bots: GameBots<State, Action> = {
  easy,
  medium: greedy({ size: 10, room: 2, block: 0 }),
  hard: greedy({ size: 10, room: 4, block: 3 }),
};
