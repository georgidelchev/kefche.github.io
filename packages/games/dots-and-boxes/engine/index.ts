// Dots and Boxes rules (SPEC §20.4 #82): players take turns drawing one line
// between two neighbouring dots. Drawing the fourth side of a box claims it
// and earns another turn. When every line is drawn, the most boxes wins;
// players tied for the most share the win. The grid grows with the number
// of players. Pure and deterministic: no randomness at all.
import type { GameResult, TurnEngine } from "@kefche/game-sdk";

/** Boxes across × boxes down per number of players. */
const SIZES: Readonly<Record<number, readonly [number, number]>> = {
  2: [4, 4],
  3: [5, 5],
  4: [6, 5],
  5: [6, 6],
};
export const sizeFor = (seats: number): readonly [number, number] => SIZES[seats] ?? [4, 4];

export interface State {
  /** Boxes across and down. */
  cols: number;
  rows: number;
  seats: number;
  /**
   * Who drew each line, -1 while free. Horizontal lines come first,
   * `r * cols + c` for r in 0..rows; then vertical ones,
   * `H + r * (cols + 1) + c` for c in 0..cols, where H = (rows + 1) * cols.
   */
  lines: number[];
  /** Owner of each box `r * cols + c`, -1 while open. */
  boxes: number[];
  turn: number;
  moves: number;
  /** The last line drawn, or null. */
  last: number | null;
  /** Boxes claimed by the last line. */
  claimed: number[];
}

export interface Action {
  line: number;
}

export const horizontalCount = (s: Pick<State, "cols" | "rows">) => (s.rows + 1) * s.cols;
export const lineCount = (s: Pick<State, "cols" | "rows">) =>
  horizontalCount(s) + s.rows * (s.cols + 1);

/** The four lines around box (r, c): top, bottom, left, right. */
export function sidesOf(
  s: Pick<State, "cols" | "rows">,
  box: number,
): [number, number, number, number] {
  const r = Math.floor(box / s.cols);
  const c = box % s.cols;
  const h = horizontalCount(s);
  return [
    r * s.cols + c,
    (r + 1) * s.cols + c,
    h + r * (s.cols + 1) + c,
    h + r * (s.cols + 1) + c + 1,
  ];
}

/** The one or two boxes a line borders. */
export function boxesOf(s: Pick<State, "cols" | "rows">, line: number): number[] {
  const h = horizontalCount(s);
  if (line < h) {
    const r = Math.floor(line / s.cols);
    const c = line % s.cols;
    return [r - 1, r].filter((row) => row >= 0 && row < s.rows).map((row) => row * s.cols + c);
  }
  const v = line - h;
  const r = Math.floor(v / (s.cols + 1));
  const c = v % (s.cols + 1);
  return [c - 1, c].filter((col) => col >= 0 && col < s.cols).map((col) => r * s.cols + col);
}

/** Drawn sides of a box (0–4). */
export const sidesDrawn = (s: State, box: number) =>
  sidesOf(s, box).reduce((n, line) => (s.lines[line] === -1 ? n : n + 1), 0);

export const isOver = (s: State) => s.moves === s.lines.length;

export const score = (s: State, seat: number) =>
  s.boxes.reduce((n, owner) => (owner === seat ? n + 1 : n), 0);

export const engine: TurnEngine<State, Action> = {
  initialState(_config, seats) {
    const [cols, rows] = sizeFor(seats);
    const size = { cols, rows };
    return {
      cols,
      rows,
      seats,
      lines: Array.from({ length: lineCount(size) }, () => -1),
      boxes: Array.from({ length: cols * rows }, () => -1),
      turn: 0,
      moves: 0,
      last: null,
      claimed: [],
    };
  },

  legalActions(state, seat) {
    if (seat !== state.turn || isOver(state)) return [];
    return state.lines.flatMap((owner, line) => (owner === -1 ? [{ line }] : []));
  },

  applyAction(state, seat, { line }) {
    if (seat !== state.turn || isOver(state) || state.lines[line] !== -1) return state;
    const lines = state.lines.slice();
    lines[line] = seat;
    const boxes = state.boxes.slice();
    const next: State = { ...state, lines, boxes, moves: state.moves + 1, last: line, claimed: [] };
    const claimed = boxesOf(state, line).filter((box) => sidesDrawn(next, box) === 4);
    for (const box of claimed) boxes[box] = seat;
    // Closing a box earns another turn.
    return {
      ...next,
      claimed,
      turn: claimed.length > 0 ? seat : (seat + 1) % state.seats,
    };
  },

  currentSeats: (state) => (isOver(state) ? [] : [state.turn]),

  result(state): GameResult | null {
    if (!isOver(state)) return null;
    const scores = Array.from({ length: state.seats }, (_, seat) => score(state, seat));
    const best = Math.max(...scores);
    const top = scores.filter((s) => s === best).length;
    return {
      completed: true,
      // One winner gets 1; players tied for the most share 0.5; a full tie is a draw.
      outcome: scores.map((s) => (s !== best ? 0 : top === 1 ? 1 : 0.5)),
    };
  },
};
