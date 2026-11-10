// Go rules (SPEC §20.1 #6): 9 × 9 (the default) or 13 × 13, Japanese
// scoring with 6.5 komi, and the ko rule. Black (seat 0) moves first.
// A stone or group with no liberty is captured; suicide is illegal; a single
// stone that just took a single stone can't be taken back at once (ko).
//
// Two passes in a row end the play and start scoring, one player at a time:
// the engine marks the stones it judges dead (from seeded random playouts),
// and the player whose turn it is accepts the count, marks a group dead or
// alive (the other player then reviews it), or resumes play. Once both have
// accepted, the game ends: each side scores its territory (empty points it
// alone surrounds) and its prisoners (stones it captured, and the other
// side's dead stones), and White adds the komi. Either side may resign at
// any time. Pure and deterministic.
import { Rng, type GameResult, type TurnEngine } from "@kefche/game-sdk";

import { EMPTY, FastBoard, groups, territory } from "./board";

export { EMPTY, FastBoard, groups, territory } from "./board";

export const SIZES = [9, 13] as const;
export type Size = (typeof SIZES)[number];
export const KOMI = 6.5;

export interface Config {
  size: Size;
}

export type Action =
  | { type: "play"; point: number }
  | { type: "pass" }
  | { type: "accept" }
  | { type: "resume" }
  | { type: "toggle"; point: number }
  | { type: "resign" };

export interface Score {
  territory: [number, number];
  prisoners: [number, number];
  /** Territory, prisoners and (for White) the komi. */
  total: [number, number];
}

export interface State {
  size: Size;
  seed: string;
  /** `board[row * size + col]`, row 0 at the top: -1 empty, 0 black, 1 white. */
  board: number[];
  turn: number;
  /** Moves and passes played (not scoring actions). */
  moves: number;
  /** The point the side to move can't play (ko), or -1. */
  ko: number;
  /** Stones each seat has captured in play. */
  captures: [number, number];
  passes: number;
  phase: "play" | "scoring" | "over";
  /** Scoring: stones marked dead. */
  dead: number[];
  /** Scoring: who has accepted the count as it stands. */
  accepted: [boolean, boolean];
  /** Scoring: who moves first if play resumes. */
  resumeTurn: number;
  /** The last move: a point (and how many stones it took), or null for a pass. */
  last: { seat: number; point: number | null; captured: number } | null;
  /** The seat that resigned, if one did. */
  resigned: number | null;
}

/** The size from a config (a room's or the setup's); anything else plays 9 × 9. */
export function configFrom(raw: unknown): Config {
  const size = (raw as { size?: unknown } | null | undefined)?.size;
  return { size: SIZES.find((s) => s === size) ?? 9 };
}

const boardOf = (state: Pick<State, "board" | "size" | "ko">) => {
  const b = new FastBoard(state.size, state.board);
  b.ko = state.ko;
  return b;
};

/** Every point `seat` may play now. */
export function legalPoints(state: State, seat: number): number[] {
  const b = boardOf(state);
  const out: number[] = [];
  for (let p = 0; p < state.size * state.size; p++) if (b.isLegal(p, seat)) out.push(p);
  return out;
}

/** Playouts for the estimate of dead stones: more on the small board. */
const ESTIMATE_PLAYOUTS: Record<Size, number> = { 9: 160, 13: 80 };

/**
 * For each point, how strongly Black (+1) or White (-1) ends up owning it
 * over seeded random playouts from this position.
 */
export function ownership(state: State, playouts = ESTIMATE_PLAYOUTS[state.size]): Float32Array {
  const n = state.size * state.size;
  const total = new Float32Array(n);
  const rng = Rng.fromSeed(`${state.seed}:own:${String(state.moves)}`);
  const random = () => rng.next();
  for (let i = 0; i < playouts; i++) {
    const b = boardOf(state);
    b.ko = -1;
    b.playout(state.turn, random, n * 3);
    for (let p = 0; p < n; p++) {
      const c = b.cells[p];
      let owner = c === 0 || c === 1 ? c : -1;
      if (owner === -1) {
        // An empty point in a finished playout is an eye: its neighbours' colour.
        const q = b.around(p)[0];
        owner = q === undefined ? -1 : (b.cells[q] ?? -1);
      }
      if (owner === 0) total[p] = (total[p] ?? 0) + 1;
      else if (owner === 1) total[p] = (total[p] ?? 0) - 1;
    }
  }
  for (let p = 0; p < n; p++) total[p] = (total[p] ?? 0) / playouts;
  return total;
}

/** The stones the engine judges dead: groups the playouts mostly give to the other side. */
export function estimateDead(state: State): number[] {
  const own = ownership(state);
  const dead: number[] = [];
  for (const group of groups(state.board, state.size)) {
    const first = group[0] ?? 0;
    const colour = state.board[first];
    const mean = group.reduce((s, p) => s + (own[p] ?? 0), 0) / group.length;
    if ((colour === 0 && mean < -0.4) || (colour === 1 && mean > 0.4)) dead.push(...group);
  }
  return dead.sort((a, b) => a - b);
}

/** The count with these stones dead (Japanese: territory and prisoners, komi to White). */
export function scoreOf(
  state: Pick<State, "board" | "size" | "captures">,
  dead: readonly number[],
): Score {
  const deadSet = new Set(dead);
  const owner = territory(state.board, state.size, deadSet);
  const area: [number, number] = [0, 0];
  for (let p = 0; p < owner.length; p++) {
    const o = owner[p];
    if (state.board[p] === EMPTY || deadSet.has(p)) {
      if (o === 0 || o === 1) area[o]++;
    }
  }
  const prisoners: [number, number] = [state.captures[0], state.captures[1]];
  for (const p of deadSet) {
    const c = state.board[p];
    if (c === 0) prisoners[1]++;
    else if (c === 1) prisoners[0]++;
  }
  return {
    territory: area,
    prisoners,
    total: [area[0] + prisoners[0], area[1] + prisoners[1] + KOMI],
  };
}

const groupAt = (state: State, point: number) =>
  groups(state.board, state.size).find((g) => g.includes(point)) ?? [];

export const engine: TurnEngine<State, Action, Config | undefined> = {
  initialState(config, _seats, seed) {
    const { size } = configFrom(config);
    return {
      size,
      seed,
      board: Array.from({ length: size * size }, () => EMPTY),
      turn: 0,
      moves: 0,
      ko: -1,
      captures: [0, 0],
      passes: 0,
      phase: "play",
      dead: [],
      accepted: [false, false],
      resumeTurn: 0,
      last: null,
      resigned: null,
    };
  },

  legalActions(state, seat) {
    if (state.phase === "over" || seat !== state.turn) return [];
    if (state.phase === "scoring") {
      const stones = state.board.flatMap((v, point) => (v === EMPTY ? [] : [point]));
      return [
        { type: "accept" },
        { type: "resume" },
        ...stones.map((point) => ({ type: "toggle", point }) as const),
      ];
    }
    return [
      ...legalPoints(state, seat).map((point) => ({ type: "play", point }) as const),
      { type: "pass" },
    ];
  },

  sideActions(state, seat) {
    return state.phase === "over" || (seat !== 0 && seat !== 1) ? [] : [{ type: "resign" }];
  },

  applyAction(state, seat, action) {
    if (state.phase === "over" || (seat !== 0 && seat !== 1)) return state;
    if (action.type === "resign") return { ...state, phase: "over", resigned: seat };
    if (seat !== state.turn) return state;
    const other = 1 - seat;

    if (state.phase === "scoring") {
      if (action.type === "accept") {
        const accepted: [boolean, boolean] = [state.accepted[0], state.accepted[1]];
        accepted[seat] = true;
        if (accepted[0] && accepted[1]) return { ...state, accepted, phase: "over" };
        return { ...state, accepted, turn: other };
      }
      if (action.type === "resume") {
        return {
          ...state,
          phase: "play",
          passes: 0,
          dead: [],
          accepted: [false, false],
          turn: state.resumeTurn,
        };
      }
      if (action.type === "toggle" && Number.isInteger(action.point)) {
        if (state.board[action.point] === EMPTY || state.board[action.point] === undefined) {
          return state;
        }
        const group = groupAt(state, action.point);
        const isDead = state.dead.includes(action.point);
        const dead = isDead
          ? state.dead.filter((p) => !group.includes(p))
          : [...state.dead, ...group].sort((a, b) => a - b);
        // The other player reviews the change.
        return { ...state, dead, accepted: [false, false], turn: other };
      }
      return state;
    }

    if (action.type === "pass") {
      const passes = state.passes + 1;
      const base = {
        ...state,
        turn: other,
        moves: state.moves + 1,
        ko: -1,
        passes,
        last: { seat, point: null, captured: 0 },
      };
      if (passes < 2) return base;
      // Two passes: scoring, starting with the player after the second pass.
      return {
        ...base,
        phase: "scoring",
        dead: estimateDead(base),
        accepted: [false, false],
        resumeTurn: other,
      };
    }
    if (action.type !== "play" || !Number.isInteger(action.point)) return state;
    const b = boardOf(state);
    if (
      action.point < 0 ||
      action.point >= state.size * state.size ||
      !b.play(action.point, seat)
    ) {
      return state;
    }
    const captures: [number, number] = [state.captures[0], state.captures[1]];
    captures[seat] += b.captures[seat] ?? 0;
    return {
      ...state,
      board: Array.from(b.cells),
      turn: other,
      moves: state.moves + 1,
      ko: b.ko,
      captures,
      passes: 0,
      last: { seat, point: action.point, captured: b.captures[seat] ?? 0 },
    };
  },

  currentSeats: (state) => (state.phase === "over" ? [] : [state.turn]),

  // Online, an away player passes (or, while scoring, accepts the count).
  skipTurn(state, seat) {
    if (state.phase === "over" || seat !== state.turn) return state;
    return engine.applyAction(state, seat, { type: state.phase === "scoring" ? "accept" : "pass" });
  },

  result(state): GameResult | null {
    if (state.phase !== "over") return null;
    if (state.resigned !== null) {
      return { completed: true, outcome: state.resigned === 0 ? [0, 1] : [1, 0] };
    }
    const { total } = scoreOf(state, state.dead);
    return { completed: true, outcome: total[0] > total[1] ? [1, 0] : [0, 1] };
  },
};
