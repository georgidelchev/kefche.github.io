// Hex bots (SPEC §9.5): Monte Carlo with "all moves as first". Each playout
// fills the empty cells at random and sees who connects (a full Hex board
// always has a winner, and the order of a random fill doesn't matter), and
// every cell the winner holds counts for the winner's candidate there. The
// bot plays the empty cell that won most often for it. Easy also plays a
// random cell a third of the time; medium and hard differ in thinking time.
// Every bot takes a winning cell and blocks one. As the second player with
// the swap rule on, a bot swaps a first stone near the centre.
import type { Bot, GameBots, Rng } from "@kefche/game-sdk";

import { EMPTY, engine, winningChain, type Action, type State } from "../engine";

/** Cells within this many steps of the centre are worth swapping. */
const SWAP_RADIUS = 3;

function playouts(
  state: State,
  seat: number,
  rng: Rng,
  deadline: number,
  now: () => number,
): number[] {
  const { size, board } = state;
  const empty = board.flatMap((v, cell) => (v === EMPTY ? [cell] : []));
  const wins = new Float64Array(size * size);
  const tries = new Float64Array(size * size);
  const fill = Int8Array.from(board);
  let rounds = 0;
  while (rounds < 200 || now() < deadline) {
    if (rounds > 200_000) break;
    rounds++;
    // A random fill: shuffle the empty cells and alternate from the side to move.
    const order = rng.shuffle(empty);
    order.forEach((cell, i) => {
      fill[cell] = i % 2 === 0 ? seat : 1 - seat;
    });
    const winner = winningChain(fill, size, seat) ? seat : 1 - seat;
    for (const cell of order) {
      if (fill[cell] === seat) {
        tries[cell] = (tries[cell] ?? 0) + 1;
        if (winner === seat) wins[cell] = (wins[cell] ?? 0) + 1;
      }
    }
  }
  return empty.toSorted(
    (a, b) =>
      (wins[b] ?? 0) / Math.max(1, tries[b] ?? 0) - (wins[a] ?? 0) / Math.max(1, tries[a] ?? 0),
  );
}

/** An empty cell that would finish a chain for `seat`, if any. */
function finishing(state: State, seat: number): number | null {
  for (let cell = 0; cell < state.board.length; cell++) {
    if (state.board[cell] !== EMPTY) continue;
    const board = state.board.slice();
    board[cell] = seat;
    if (winningChain(board, state.size, seat)) return cell;
  }
  return null;
}

const bot = (mistakes: number): Bot<State, Action> => ({
  choose(state, seat, { rng, deadline, now }) {
    const actions = engine.legalActions(state, seat);
    if (actions.some((a) => a.type === "swap") && state.last !== null) {
      const centre = Math.floor(state.size / 2);
      const r = Math.floor(state.last / state.size);
      const c = state.last % state.size;
      if (Math.abs(r - centre) + Math.abs(c - centre) <= SWAP_RADIUS) return { type: "swap" };
    }
    const win = finishing(state, seat);
    if (win !== null) return { type: "play", cell: win };
    const block = finishing(state, 1 - seat);
    if (block !== null && (mistakes === 0 || rng.next() > mistakes))
      return { type: "play", cell: block };
    const plays = actions.filter((a): a is { type: "play"; cell: number } => a.type === "play");
    if (rng.next() < mistakes) return rng.pick(plays);
    const [best] = playouts(state, seat, rng, deadline, now);
    return best === undefined ? rng.pick(plays) : { type: "play", cell: best };
  },
});

export const bots: GameBots<State, Action> = {
  easy: bot(0.35),
  medium: bot(0),
  hard: bot(0),
};
