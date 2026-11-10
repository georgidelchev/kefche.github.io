// Chinese Checkers rules (SPEC §20.9 #89): a six-pointed star of 121 holes,
// for 2, 3, 4, 5 or 6 players. Each player starts with 10 pieces in one
// point of the star and races them into the point opposite. On a turn you
// move one piece: a step to a neighbouring empty hole, or a chain of jumps,
// each over one neighbouring piece (anyone's) into the empty hole beyond,
// stopping wherever you like. A move may not end in a point that is neither
// your own nor your goal. The first to fill their goal wins; a rival's piece
// left in your goal counts as filled once the rest is yours. If nobody has
// finished after 100 turns each, the most pieces in their goal wins. Pure and
// deterministic.
//
// Holes use cube coordinates (x + y + z = 0): the star is the union of the
// triangles {x, y, z ≥ -4} and {x, y, z ≤ 4}; its six points are where one
// coordinate passes ±4.
import type { GameResult, TurnEngine } from "@kefche/game-sdk";

export const EMPTY = -1;
/** Turns each before the game is decided by pieces home. */
export const TURN_LIMIT = 100;

/** The six points of the star, in order around it: [axis, sign]. */
export const ARMS = [
  [2, -1],
  [0, 1],
  [1, -1],
  [2, 1],
  [0, -1],
  [1, 1],
] as const;

export interface Hole {
  x: number;
  y: number;
  z: number;
  /** The star point it lies in (an index into ARMS), or -1 in the middle. */
  arm: number;
}

function buildHoles(): Hole[] {
  const out: Hole[] = [];
  for (let x = -8; x <= 8; x++) {
    for (let y = -8; y <= 8; y++) {
      const z = -x - y;
      const c = [x, y, z];
      const inA = c.every((v) => v >= -4);
      const inB = c.every((v) => v <= 4);
      if (!inA && !inB) continue;
      const arm = ARMS.findIndex(([axis, sign]) => (c[axis] ?? 0) * sign > 4);
      out.push({ x, y, z, arm });
    }
  }
  // Top to bottom, then left to right, for a stable order.
  return out.sort((a, b) => a.z - b.z || a.x - b.x);
}

export const HOLES: readonly Hole[] = buildHoles();
const INDEX = new Map(HOLES.map((h, i) => [`${String(h.x)},${String(h.y)}`, i]));
export const holeAt = (x: number, y: number) => INDEX.get(`${String(x)},${String(y)}`) ?? -1;

const DIRECTIONS = [
  [1, -1],
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
] as const;
/** Each hole's neighbour in each direction, or -1. */
export const NEXT: readonly (readonly number[])[] = HOLES.map((h) =>
  DIRECTIONS.map(([dx, dy]) => holeAt(h.x + dx, h.y + dy)),
);

/**
 * Which point each seat starts in, by number of players: seat 0 at the
 * bottom (point 3), so the person playing bots starts nearest them; three
 * players on alternate points, four on two opposite pairs.
 */
export const HOMES: Readonly<Record<number, readonly number[]>> = {
  2: [3, 0],
  3: [3, 5, 1],
  4: [3, 4, 0, 1],
  5: [3, 4, 5, 0, 1],
  6: [3, 4, 5, 0, 1, 2],
};
export const opposite = (arm: number) => (arm + 3) % 6;
export const armHoles = (arm: number) => HOLES.flatMap((h, i) => (h.arm === arm ? [i] : []));

export interface Action {
  from: number;
  to: number;
}

export interface State {
  seats: number;
  /** One per hole: -1 empty, else the seat. */
  board: number[];
  turn: number;
  moves: number;
  last: { seat: number; from: number; to: number; jumps: number[] } | null;
  winner: number | null;
  over: boolean;
}

export const homeOf = (seats: number, seat: number) => HOMES[seats]?.[seat] ?? 0;
export const goalOf = (seats: number, seat: number) => opposite(homeOf(seats, seat));

/** Where the piece on `from` may end its move, with the holes it jumps through. */
export function reach(state: State, from: number): Map<number, number[]> {
  const { board } = state;
  const seat = board[from] ?? EMPTY;
  const home = homeOf(state.seats, seat);
  const goal = goalOf(state.seats, seat);
  const allowed = (hole: number) => {
    const arm = HOLES[hole]?.arm ?? -1;
    return arm === -1 || arm === home || arm === goal;
  };
  const found = new Map<number, number[]>();
  // Steps.
  for (const n of NEXT[from] ?? []) {
    if (n >= 0 && board[n] === EMPTY && allowed(n)) found.set(n, [n]);
  }
  // Jump chains, breadth first; the piece has left `from`.
  const seen = new Set([from]);
  const queue: [number, number[]][] = [[from, []]];
  while (queue.length > 0) {
    const [at, path] = queue.shift() ?? [from, []];
    (NEXT[at] ?? []).forEach((over, d) => {
      if (over < 0 || over === from || board[over] === EMPTY) return;
      const land = NEXT[over]?.[d] ?? -1;
      if (land < 0 || seen.has(land) || (board[land] !== EMPTY && land !== from)) return;
      seen.add(land);
      const route = [...path, land];
      queue.push([land, route]);
      if (allowed(land) && land !== from && !found.has(land)) found.set(land, route);
    });
  }
  return found;
}

export function movesFor(state: State, seat: number): Action[] {
  const out: Action[] = [];
  state.board.forEach((v, from) => {
    if (v !== seat) return;
    for (const to of reach(state, from).keys()) out.push({ from, to });
  });
  return out;
}

/** Pieces of `seat` in its goal. */
export const homeCount = (state: State, seat: number) =>
  armHoles(goalOf(state.seats, seat)).filter((h) => state.board[h] === seat).length;

function finished(state: State, seat: number): boolean {
  const goal = armHoles(goalOf(state.seats, seat));
  return goal.every((h) => state.board[h] !== EMPTY) && goal.some((h) => state.board[h] === seat);
}

export const engine: TurnEngine<State, Action> = {
  initialState(_config, seats) {
    const board = HOLES.map(() => EMPTY);
    for (let seat = 0; seat < seats; seat++) {
      for (const h of armHoles(homeOf(seats, seat))) board[h] = seat;
    }
    return { seats, board, turn: 0, moves: 0, last: null, winner: null, over: false };
  },

  legalActions(state, seat) {
    if (state.over || seat !== state.turn) return [];
    return movesFor(state, seat);
  },

  applyAction(state, seat, { from, to }) {
    if (state.over || seat !== state.turn || state.board[from] !== seat) return state;
    const route = reach(state, from).get(to);
    if (!route) return state;
    const board = state.board.slice();
    board[from] = EMPTY;
    board[to] = seat;
    const jumps = route.length === 1 && (NEXT[from] ?? []).includes(to) ? [] : route;
    const base = { ...state, board, moves: state.moves + 1, last: { seat, from, to, jumps } };
    if (finished(base, seat)) return { ...base, winner: seat, over: true };
    if (base.moves >= TURN_LIMIT * state.seats) {
      const counts = Array.from({ length: state.seats }, (_, s) => homeCount(base, s));
      const best = Math.max(...counts);
      const leaders = counts.flatMap((c, s) => (c === best ? [s] : []));
      return { ...base, over: true, winner: leaders.length === 1 ? (leaders[0] ?? null) : null };
    }
    return { ...base, turn: (seat + 1) % state.seats };
  },

  currentSeats: (state) => (state.over ? [] : [state.turn]),

  // Online, an away player's turn passes to the next seat.
  skipTurn(state, seat) {
    if (state.over || seat !== state.turn) return state;
    return { ...state, turn: (seat + 1) % state.seats, last: null };
  },

  result(state): GameResult | null {
    if (!state.over) return null;
    const outcome = Array.from({ length: state.seats }, (_, s) =>
      state.winner === null ? 0.5 : s === state.winner ? 1 : 0,
    );
    return { completed: true, outcome };
  },
};
