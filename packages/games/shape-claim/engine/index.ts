// Shape Claim rules (SPEC §20.9 #88, owner decision Q3): an original
// territory game with polyomino pieces for 2–4 players. The board is 14 × 14
// for two, 17 × 17 for three and 20 × 20 for four. Instead of a set of their
// own, players share a row of four pieces, refilled from a bag that holds
// one set of the 21 shapes of 1–5 cells per player, shuffled from the seed.
// On your turn you take a piece from the row and place it, turned or flipped
// as you like: your first piece covers your corner of the board; every later
// one must touch your own colour at a corner, and never along an edge. A
// player who can't place any piece in the row passes, and the oldest piece in
// the row is set aside for a new one from the bag. The game ends when the
// pieces run out, or everyone passes in turn with the bag empty, and the most
// cells covered wins. Pure and deterministic.
import { Rng, type GameResult, type TurnEngine } from "@kefche/game-sdk";

export const EMPTY = -1;
export const ROW = 4;

/** The 21 free polyominoes of 1–5 cells, as [row, col] cells. */
export const SHAPES: readonly (readonly (readonly [number, number])[])[] = [
  [[0, 0]],
  [
    [0, 0],
    [0, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 0],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 2],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 0],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
    [1, 3],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
    [2, 0],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 0],
    [0, 2],
    [1, 0],
    [1, 1],
    [1, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [1, 2],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [1, 2],
    [2, 1],
  ],
  [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, 2],
    [2, 1],
  ],
];

export const sizeFor = (seats: number) => (seats <= 2 ? 14 : seats === 3 ? 17 : 20);

type Cells = readonly (readonly [number, number])[];
const normalize = (cells: Cells): [number, number][] => {
  const minR = Math.min(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  return cells
    .map(([r, c]) => [r - minR, c - minC] as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
};
const keyOf = (cells: Cells) =>
  normalize(cells)
    .map(([r, c]) => `${String(r)},${String(c)}`)
    .join(" ");

/** Every distinct orientation of a shape (turned and flipped), normalized. */
export function orientations(shape: number): [number, number][][] {
  const base = SHAPES[shape] ?? [];
  const out = new Map<string, [number, number][]>();
  let cells: [number, number][] = base.map(([r, c]) => [r, c]);
  for (let flip = 0; flip < 2; flip++) {
    for (let turn = 0; turn < 4; turn++) {
      const n = normalize(cells);
      out.set(keyOf(n), n);
      cells = cells.map(([r, c]) => [c, -r]);
    }
    cells = cells.map(([r, c]) => [r, -c]);
  }
  return [...out.values()];
}
const ORIENTATIONS = SHAPES.map((_, i) => orientations(i));
const SHAPE_KEYS = ORIENTATIONS.map((list) => new Set(list.map((o) => keyOf(o))));

export type Action = { type: "place"; slot: number; cells: number[] } | { type: "pass" };

export interface State {
  size: number;
  seats: number;
  /** One per cell: -1 empty, else the seat. */
  board: number[];
  /** The shapes on offer (indexes into SHAPES). */
  row: number[];
  /** The shapes still in the bag, drawn from the front. */
  bag: number[];
  turn: number;
  moves: number;
  /** Passes in a row; everyone passing ends the game. */
  passes: number;
  /** Whether each seat has placed its first piece. */
  started: boolean[];
  last: { seat: number; cells: number[] } | null;
  over: boolean;
}

/** A seat's starting corner. */
export function cornerOf(size: number, seats: number, seat: number): number {
  const last = size - 1;
  const corners = seats <= 2 ? [0, last * size + last] : [0, last, last * size + last, last * size];
  return corners[seat] ?? 0;
}

export const scoreOf = (state: State, seat: number) =>
  state.board.reduce((n, v) => (v === seat ? n + 1 : n), 0);

/** Whether `seat` may cover these cells now. */
export function fits(state: State, seat: number, cells: readonly number[]): boolean {
  const { board, size } = state;
  let corner = false;
  for (const cell of cells) {
    if (cell < 0 || cell >= board.length || board[cell] !== EMPTY) return false;
    const r = Math.floor(cell / size);
    const c = cell % size;
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < size && cc >= 0 && cc < size && board[rr * size + cc] === seat)
        return false;
    }
    for (const [dr, dc] of [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ] as const) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < size && cc >= 0 && cc < size && board[rr * size + cc] === seat)
        corner = true;
    }
  }
  if (!state.started[seat]) return cells.includes(cornerOf(size, state.seats, seat));
  return corner;
}

/** The cells of an orientation placed with its [0, 0] cell at (r, c), or null off the board. */
function placed(
  o: readonly (readonly [number, number])[],
  r: number,
  c: number,
  size: number,
): number[] | null {
  const out: number[] = [];
  for (const [dr, dc] of o) {
    const rr = r + dr;
    const cc = c + dc;
    if (rr < 0 || rr >= size || cc < 0 || cc >= size) return null;
    out.push(rr * size + cc);
  }
  return out;
}

/** Empty cells where `seat`'s next piece could reach (corner contact, or its starting corner). */
function anchors(state: State, seat: number): number[] {
  const { board, size } = state;
  if (!state.started[seat]) return [cornerOf(size, state.seats, seat)];
  const out: number[] = [];
  board.forEach((v, cell) => {
    if (v !== EMPTY) return;
    if (fits(state, seat, [cell])) out.push(cell);
  });
  return out;
}

/** Every placement of the piece in `slot` for `seat`, each covering one of the anchors. */
export function placements(state: State, seat: number, slot: number): number[][] {
  const shape = state.row[slot];
  if (shape === undefined) return [];
  const { size } = state;
  const seen = new Set<string>();
  const out: number[][] = [];
  for (const anchor of anchors(state, seat)) {
    const ar = Math.floor(anchor / size);
    const ac = anchor % size;
    for (const o of ORIENTATIONS[shape] ?? []) {
      for (const [pr, pc] of o) {
        const cells = placed(o, ar - pr, ac - pc, size);
        if (!cells) continue;
        const sorted = cells.toSorted((a, b) => a - b);
        const key = sorted.join(",");
        if (seen.has(key) || !fits(state, seat, sorted)) continue;
        seen.add(key);
        out.push(sorted);
      }
    }
  }
  return out;
}

export function canPlace(state: State, seat: number): boolean {
  return state.row.some((_, slot) => placements(state, seat, slot).length > 0);
}

/** Whether these cells are the shape in `slot`, in some orientation. */
function isShape(state: State, slot: number, cells: readonly number[]): boolean {
  const shape = state.row[slot];
  if (shape === undefined || cells.length !== (SHAPES[shape]?.length ?? -1)) return false;
  const { size } = state;
  const rc = cells.map((cell) => [Math.floor(cell / size), cell % size] as [number, number]);
  return SHAPE_KEYS[shape]?.has(keyOf(rc)) ?? false;
}

export const engine: TurnEngine<State, Action> = {
  initialState(_config, seats, seed) {
    const size = sizeFor(seats);
    const rng = Rng.fromSeed(`${seed}:bag`);
    const bag = rng.shuffle(
      Array.from({ length: seats * SHAPES.length }, (_, i) => i % SHAPES.length),
    );
    return {
      size,
      seats,
      board: Array.from({ length: size * size }, () => EMPTY),
      row: bag.slice(0, ROW),
      bag: bag.slice(ROW),
      turn: 0,
      moves: 0,
      passes: 0,
      started: Array.from({ length: seats }, () => false),
      last: null,
      over: false,
    };
  },

  legalActions(state, seat) {
    if (state.over || seat !== state.turn) return [];
    const out: Action[] = [];
    state.row.forEach((_, slot) => {
      for (const cells of placements(state, seat, slot)) out.push({ type: "place", slot, cells });
    });
    return out.length > 0 ? out : [{ type: "pass" }];
  },

  applyAction(state, seat, action) {
    if (state.over || seat !== state.turn) return state;
    const next = (seat + 1) % state.seats;
    if (action.type === "pass") {
      if (canPlace(state, seat)) return state;
      // The oldest piece in the row is set aside and a new one drawn, so the row changes.
      const row = state.row.slice(1);
      const bag = state.bag.slice();
      const refill = bag.shift();
      if (refill !== undefined) row.push(refill);
      const passes = state.passes + 1;
      const over =
        row.length === 0 || (passes >= state.seats && bag.length === 0 && refill === undefined);
      return { ...state, row, bag, turn: next, moves: state.moves + 1, passes, last: null, over };
    }
    const cells = Array.isArray(action.cells) ? action.cells.toSorted((a, b) => a - b) : [];
    if (!isShape(state, action.slot, cells) || !fits(state, seat, cells)) return state;
    const board = state.board.slice();
    for (const cell of cells) board[cell] = seat;
    const row = state.row.slice();
    const bag = state.bag.slice();
    const refill = bag.shift();
    if (refill === undefined) row.splice(action.slot, 1);
    else row[action.slot] = refill;
    const started = state.started.slice();
    started[seat] = true;
    return {
      ...state,
      board,
      row,
      bag,
      started,
      turn: next,
      moves: state.moves + 1,
      passes: 0,
      last: { seat, cells },
      over: row.length === 0,
    };
  },

  currentSeats: (state) => (state.over ? [] : [state.turn]),

  // Online, an away player's turn passes to the next seat.
  skipTurn(state, seat) {
    if (state.over || seat !== state.turn) return state;
    return { ...state, turn: (seat + 1) % state.seats, last: null };
  },

  result(state): GameResult | null {
    if (!state.over) return null;
    const scores = Array.from({ length: state.seats }, (_, s) => scoreOf(state, s));
    const best = Math.max(...scores);
    const winners = scores.filter((s) => s === best).length;
    return {
      completed: true,
      outcome: scores.map((s) => (s === best ? (winners > 1 ? 0.5 : 1) : 0)),
    };
  },
};
