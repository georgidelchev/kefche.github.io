// Snake rules (SPEC §20.4 #32): steer the snake to the food; it grows by one
// per food and dies on its own body, or on the walls when walls are on (with
// wrap-around it comes out the other side). Pure and deterministic: food
// placement comes from the seeded RNG, and time is a stream of "tick"
// actions, so the same seed and inputs replay the same game.
import { Rng, seedRng, type GameResult, type RaceEngine, type RngState } from "@kefche/game-sdk";

export const COLS = 20;
export const ROWS = 20;
const CELLS = COLS * ROWS;

export const SPEEDS = ["slow", "normal", "fast"] as const;
export type Speed = (typeof SPEEDS)[number];

/** Points per food: faster play scores more. */
export const POINTS: Record<Speed, number> = { slow: 1, normal: 2, fast: 3 };
/** Milliseconds per step at the start; the snake speeds up as it grows. */
export const STEP_MS: Record<Speed, number> = { slow: 160, normal: 115, fast: 80 };

export type Direction = "up" | "down" | "left" | "right";

export interface Config {
  speed: Speed;
  /** Walls kill; without them the snake wraps around the edges. */
  walls: boolean;
}

export interface State {
  config: Config;
  /** Cells (row × COLS + col), head first. */
  snake: number[];
  direction: Direction;
  /** Turns pressed but not yet taken, oldest first (at most 2). */
  queue: Direction[];
  /** Food cell, or -1 when the board is full. */
  food: number;
  rng: RngState;
  score: number;
  eaten: number;
  ticks: number;
  over: boolean;
  /** The snake filled the board. */
  won: boolean;
}

export type Action = { type: "turn"; direction: Direction } | { type: "tick" };

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};
const DELTA: Record<Direction, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};
const QUEUE_LIMIT = 2;

export const rowOf = (cell: number) => Math.floor(cell / COLS);
export const colOf = (cell: number) => cell % COLS;

function placeFood(snake: readonly number[], rng: RngState): { food: number; rng: RngState } {
  const taken = new Set(snake);
  const free: number[] = [];
  for (let c = 0; c < CELLS; c++) if (!taken.has(c)) free.push(c);
  if (free.length === 0) return { food: -1, rng };
  const r = new Rng(rng);
  const food = r.pick(free);
  return { food, rng: r.state };
}

/** The cell one step from `cell`, or null through a wall. */
export function neighbor(cell: number, direction: Direction, walls: boolean): number | null {
  const [dr, dc] = DELTA[direction];
  let r = rowOf(cell) + dr;
  let c = colOf(cell) + dc;
  if (walls && (r < 0 || r >= ROWS || c < 0 || c >= COLS)) return null;
  r = (r + ROWS) % ROWS;
  c = (c + COLS) % COLS;
  return r * COLS + c;
}

export const engine: RaceEngine<State, Action, Config> = {
  initialState(config, seed) {
    const middle = Math.floor(ROWS / 2) * COLS + Math.floor(COLS / 2) - 3;
    const snake = [middle, middle - 1, middle - 2];
    return {
      config,
      snake,
      direction: "right",
      queue: [],
      ...placeFood(snake, seedRng(`snake:${seed}`)),
      score: 0,
      eaten: 0,
      ticks: 0,
      over: false,
      won: false,
    };
  },

  apply(state, action) {
    if (state.over) return state;

    if (action.type === "turn") {
      const last = state.queue.at(-1) ?? state.direction;
      if (
        action.direction === last ||
        action.direction === OPPOSITE[last] ||
        state.queue.length >= QUEUE_LIMIT
      ) {
        return state;
      }
      return { ...state, queue: [...state.queue, action.direction] };
    }

    const [turn, ...queue] = state.queue;
    const direction = turn ?? state.direction;
    const head = state.snake[0] ?? 0;
    const next = neighbor(head, direction, state.config.walls);
    const eats = next === state.food;
    // The tail moves out of the way unless the snake is growing this step.
    const body = eats ? state.snake : state.snake.slice(0, -1);
    const ticks = state.ticks + 1;
    if (next === null || body.includes(next)) {
      return { ...state, direction, queue, ticks, over: true };
    }
    const snake = [next, ...body];
    if (!eats) return { ...state, snake, direction, queue, ticks };
    const placed = placeFood(snake, state.rng);
    const won = placed.food === -1;
    return {
      ...state,
      snake,
      direction,
      queue,
      ticks,
      ...placed,
      score: state.score + POINTS[state.config.speed],
      eaten: state.eaten + 1,
      over: won,
      won,
    };
  },

  progress(state) {
    return state.snake.length / CELLS;
  },

  result(state): GameResult | null {
    return state.over ? { score: state.score, completed: state.won } : null;
  },
};

/** Step length for the current state: 2% faster per food, down to 60%. */
export const stepMs = (state: State) =>
  Math.round(STEP_MS[state.config.speed] * Math.max(0.6, 0.98 ** state.eaten));
