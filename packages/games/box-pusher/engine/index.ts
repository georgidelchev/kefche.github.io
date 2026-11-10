// Box Pusher rules (SPEC §20.3 #28): walk the warehouse and push every box
// onto a goal. Boxes can be pushed, one at a time, never pulled. Undo takes
// back a step and restart starts the level again.
//
// Levels: 20 fixed ones per difficulty (bank.gen.ts, made by
// scripts/box-pusher-bank.mjs), or a fresh one made from the seed (races and
// the daily challenge). Every level is made by searching backwards from the
// solved position, so it's solvable and its fewest pushes are known
// (level.ts). Pure and deterministic.
import type { GameResult, RaceEngine } from "@kefche/game-sdk";

import { BANK } from "./bank.gen";
import { fromText, makeLevel, type Level, type LevelSpec } from "./level";

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
/** Fixed levels per difficulty; 0 is a fresh level. */
export const LEVELS = 20;

export interface Config {
  difficulty: Difficulty;
  /** 1–20: a fixed level; 0: a fresh one from the seed. */
  level: number;
}

export const SPECS: Record<Difficulty, LevelSpec> = {
  easy: { inner: 5, boxes: 2, walls: 0.2, minPushes: 10, rooms: 40, budget: 50_000 },
  medium: { inner: 6, boxes: 3, walls: 0.25, minPushes: 18, rooms: 40, budget: 80_000 },
  hard: { inner: 7, boxes: 3, walls: 0.3, minPushes: 22, rooms: 40, budget: 150_000 },
};

export type Dir = "up" | "down" | "left" | "right";
export const DIRS: readonly Dir[] = ["up", "down", "left", "right"];

export type Action =
  | { type: "step"; dir: Dir }
  /** Walks to a cell by the shortest way, without pushing. */
  | { type: "walk"; to: number }
  | { type: "undo" }
  | { type: "restart" };

export interface State {
  config: Config;
  level: Level;
  boxes: number[];
  player: number;
  /** Each step so far: its direction (0–3) times two, plus one if it pushed. */
  trail: number[];
  /** Pushes so far (undone ones not counted). */
  pushes: number;
}

export const configFrom = (raw: unknown): Config => {
  const r = (raw ?? {}) as { difficulty?: unknown; level?: unknown };
  const difficulty = DIFFICULTIES.find((d) => d === r.difficulty) ?? "easy";
  const level =
    typeof r.level === "number" && Number.isInteger(r.level) && r.level >= 0 && r.level <= LEVELS
      ? r.level
      : 0;
  return { difficulty, level };
};

export function levelFor(config: Config, seed: string): Level {
  if (config.level > 0) {
    const entry = BANK[config.difficulty][config.level - 1];
    if (entry) return fromText(entry[0], entry[1]);
  }
  return makeLevel(`${seed}:box-pusher:${config.difficulty}`, SPECS[config.difficulty]);
}

export const offset = (dir: Dir | number, width: number) => {
  const d = typeof dir === "number" ? DIRS[dir] : dir;
  return d === "up" ? -width : d === "down" ? width : d === "left" ? -1 : 1;
};

export const solved = (state: State) => state.level.goals.every((g) => state.boxes.includes(g));

/** The shortest walk to a cell without pushing: directions, or null when it can't be reached. */
export function walkTo(state: State, to: number): Dir[] | null {
  const { width, floor } = state.level;
  if (!floor[to] || state.boxes.includes(to)) return null;
  const from = state.player;
  const prev = new Map<number, [number, Dir]>();
  const queue = [from];
  const seen = new Set([from]);
  while (queue.length > 0) {
    const at = queue.shift() ?? from;
    if (at === to) break;
    for (const dir of DIRS) {
      const y = at + offset(dir, width);
      if (seen.has(y) || !floor[y] || state.boxes.includes(y)) continue;
      seen.add(y);
      prev.set(y, [at, dir]);
      queue.push(y);
    }
  }
  if (!seen.has(to)) return null;
  const path: Dir[] = [];
  for (let at = to; at !== from;) {
    const step = prev.get(at);
    if (!step) return null;
    path.unshift(step[1]);
    at = step[0];
  }
  return path;
}

function step(state: State, dir: Dir, push: boolean): State | null {
  const d = offset(dir, state.level.width);
  const to = state.player + d;
  if (!state.level.floor[to]) return null;
  const box = state.boxes.indexOf(to);
  if (box >= 0) {
    if (!push) return null;
    const beyond = to + d;
    if (!state.level.floor[beyond] || state.boxes.includes(beyond)) return null;
    const boxes = state.boxes.map((b, i) => (i === box ? beyond : b));
    return {
      ...state,
      boxes,
      player: to,
      trail: [...state.trail, DIRS.indexOf(dir) * 2 + 1],
      pushes: state.pushes + 1,
    };
  }
  return { ...state, player: to, trail: [...state.trail, DIRS.indexOf(dir) * 2] };
}

export const engine: RaceEngine<State, Action, Config | undefined> = {
  initialState(raw, seed) {
    const config = configFrom(raw);
    const level = levelFor(config, seed);
    return { config, level, boxes: level.boxes, player: level.player, trail: [], pushes: 0 };
  },

  apply(state, action) {
    if (solved(state) || typeof action !== "object" || (action as unknown) === null) return state;
    switch (action.type) {
      case "step":
        return DIRS.includes(action.dir) ? (step(state, action.dir, true) ?? state) : state;
      case "walk": {
        if (!Number.isInteger(action.to)) return state;
        const path = walkTo(state, action.to);
        if (!path || path.length === 0) return state;
        let next = state;
        for (const dir of path) next = step(next, dir, false) ?? next;
        return next;
      }
      case "undo": {
        const last = state.trail.at(-1);
        if (last === undefined) return state;
        const d = offset(last >> 1, state.level.width);
        const pushed = (last & 1) === 1;
        const boxes = pushed
          ? state.boxes.map((b) => (b === state.player + d ? state.player : b))
          : state.boxes;
        return {
          ...state,
          boxes,
          player: state.player - d,
          trail: state.trail.slice(0, -1),
          pushes: state.pushes - (pushed ? 1 : 0),
        };
      }
      case "restart":
        return state.trail.length === 0
          ? state
          : {
              ...state,
              boxes: state.level.boxes,
              player: state.level.player,
              trail: [],
              pushes: 0,
            };
      default:
        return state;
    }
  },

  progress: (state) =>
    state.level.goals.filter((g) => state.boxes.includes(g)).length /
    Math.max(1, state.level.goals.length),

  result: (state): GameResult | null =>
    solved(state) ? { completed: true, score: state.trail.length } : null,
};
