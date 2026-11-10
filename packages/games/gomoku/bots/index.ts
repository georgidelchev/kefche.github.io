// Line-game bots (SPEC §9.5), for Gomoku and Five Colors: each point near
// the stones is scored by the lines it would make for the bot (attack) and
// break for its opponents (defence), counting stones in a row and open ends.
// Every bot takes a win and blocks one. Easy picks loosely among the good
// points; medium plays the best; hard also looks at each opponent's best
// reply to its top candidates, within its time.
import type { Bot, GameBots, Rng } from "@kefche/game-sdk";

import { DIRECTIONS, EMPTY, type Action, type State } from "../engine/lines";

const WIN = 1_000_000;

/** The value of a run of `count` stones with `open` empty ends, toward `line`. */
function runValue(count: number, open: number, line: number): number {
  if (count >= line) return WIN;
  if (open === 0) return 0;
  const missing = line - count;
  const table = [
    0,
    open === 2 ? 50_000 : 6_000,
    open === 2 ? 4_000 : 400,
    open === 2 ? 250 : 25,
    open === 2 ? 12 : 2,
  ];
  return table[missing] ?? 1;
}

/** What a stone of `seat` on the empty `point` would be worth to `seat`. */
export function pointValue(state: State, point: number, seat: number): number {
  const { board, size, line, exact } = state;
  const r0 = Math.floor(point / size);
  const c0 = point % size;
  let total = 0;
  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;
    let open = 0;
    for (const sign of [-1, 1]) {
      let r = r0 + sign * dr;
      let c = c0 + sign * dc;
      while (r >= 0 && r < size && c >= 0 && c < size && board[r * size + c] === seat) {
        count++;
        r += sign * dr;
        c += sign * dc;
      }
      if (r >= 0 && r < size && c >= 0 && c < size && board[r * size + c] === EMPTY) open++;
    }
    if (exact && count > line) continue;
    total += runValue(count, open, line);
  }
  return total;
}

/** Empty points within two of a stone (the centre on an empty board). */
export function candidates(state: State): number[] {
  const { board, size } = state;
  const near = new Set<number>();
  board.forEach((v, p) => {
    if (v === EMPTY) return;
    const r = Math.floor(p / size);
    const c = p % size;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < size && cc >= 0 && cc < size && board[rr * size + cc] === EMPTY)
          near.add(rr * size + cc);
      }
    }
  });
  if (near.size === 0) return [Math.floor(size / 2) * size + Math.floor(size / 2)];
  return [...near];
}

const others = (state: State, seat: number) =>
  Array.from({ length: state.seats }, (_, s) => s).filter((s) => s !== seat);

/** Attack plus the strongest defence, for each candidate, best first. */
function ranked(
  state: State,
  seat: number,
): { point: number; attack: number; defence: number; value: number }[] {
  return candidates(state)
    .map((point) => {
      const attack = pointValue(state, point, seat);
      const defence = Math.max(0, ...others(state, seat).map((o) => pointValue(state, point, o)));
      return { point, attack, defence, value: attack + 0.9 * defence };
    })
    .sort((a, b) => b.value - a.value);
}

/** A win, or a block of an opponent's win, if there is one. */
function forced(list: ReturnType<typeof ranked>): number | null {
  const win = list.find((c) => c.attack >= WIN);
  if (win) return win.point;
  const block = list.find((c) => c.defence >= WIN);
  return block ? block.point : null;
}

const place = (state: State, point: number, seat: number): State => {
  const board = state.board.slice();
  board[point] = seat;
  return { ...state, board };
};

function choose(
  state: State,
  seat: number,
  rng: Rng,
  level: "easy" | "medium" | "hard",
  deadline: number,
  now: () => number,
): Action {
  const list = ranked(state, seat);
  const must = forced(list);
  if (must !== null) return { point: must };
  const first = list[0];
  if (!first) return { point: state.board.indexOf(EMPTY) };
  if (level === "easy") {
    if (rng.next() < 0.25) return { point: rng.pick(list).point };
    return { point: rng.pick(list.slice(0, 5)).point };
  }
  if (level === "medium") return { point: first.point };
  // Hard: the top candidates, each weighed against the next player's best reply.
  const next = (seat + 1) % state.seats;
  let best = first.point;
  let bestScore = -Infinity;
  for (const c of list.slice(0, 10)) {
    if (now() > deadline) break;
    const after = place(state, c.point, seat);
    // The reply's own attack: blocking this move is already in c.value.
    const threat = Math.max(0, ...candidates(after).map((p) => pointValue(after, p, next)));
    const score = c.value - 0.8 * threat;
    if (score > bestScore) {
      bestScore = score;
      best = c.point;
    }
  }
  return { point: best };
}

const bot = (level: "easy" | "medium" | "hard"): Bot<State, Action> => ({
  choose(state, seat, { rng, deadline, now }) {
    return choose(state, seat, rng, level, deadline, now);
  },
});

export const bots: GameBots<State, Action> = {
  easy: bot("easy"),
  medium: bot("medium"),
  hard: bot("hard"),
};
