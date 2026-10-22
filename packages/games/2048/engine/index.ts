// 2048 rules: slide tiles, merge equal pairs once per move, add a 2 (90%) or
// a 4 (10%) after every move that changes the board. Reaching 2048 wins; the
// player may keep going. One undo per game (SPEC §20 catalog note). Pure and
// deterministic: randomness comes from the seeded RNG in the state.
import { Rng, seedRng, type GameResult, type RaceEngine, type RngState } from "@kefche/game-sdk";

export const SIZE = 4;
export const GOAL = 2048;

export interface Tile {
  /** Stable across moves, so the renderer can animate slides. */
  id: number;
  value: number;
  row: number;
  col: number;
  /** Created by a merge on the last move. */
  merged?: true;
  /** Spawned after the last move. */
  spawned?: true;
}

interface Snapshot {
  tiles: Tile[];
  score: number;
  rng: RngState;
  nextId: number;
}

export interface State extends Snapshot {
  moves: number;
  /** Reached 2048 at some point. */
  won: boolean;
  /** Chose to continue after winning. */
  continued: boolean;
  /** No move changes the board any more. */
  over: boolean;
  /** Board before the last move, while the undo is still unused. */
  undo: Snapshot | null;
  undoUsed: boolean;
}

export type Direction = "up" | "down" | "left" | "right";
export type Action =
  { type: "move"; direction: Direction } | { type: "undo" } | { type: "continue" };

function spawn(snapshot: Snapshot): Snapshot {
  const taken = new Set(snapshot.tiles.map((t) => t.row * SIZE + t.col));
  const free = Array.from({ length: SIZE * SIZE }, (_, i) => i).filter((i) => !taken.has(i));
  if (free.length === 0) return snapshot;
  const rng = new Rng(snapshot.rng);
  const cell = rng.pick(free);
  const value = rng.next() < 0.9 ? 2 : 4;
  return {
    tiles: [
      ...snapshot.tiles,
      { id: snapshot.nextId, value, row: Math.floor(cell / SIZE), col: cell % SIZE, spawned: true },
    ],
    score: snapshot.score,
    rng: rng.state,
    nextId: snapshot.nextId + 1,
  };
}

/** Slides every line toward `direction`; returns null when nothing moves. */
function slide(snapshot: Snapshot, direction: Direction): Snapshot | null {
  const vertical = direction === "up" || direction === "down";
  const reverse = direction === "right" || direction === "down";
  let nextId = snapshot.nextId;
  let gained = 0;
  let moved = false;
  const out: Tile[] = [];

  for (let line = 0; line < SIZE; line++) {
    const inLine = snapshot.tiles
      .filter((t) => (vertical ? t.col : t.row) === line)
      .sort((a, b) => (vertical ? a.row - b.row : a.col - b.col) * (reverse ? -1 : 1));
    let slot = 0;
    for (let i = 0; i < inLine.length; i++) {
      const tile = inLine[i];
      if (!tile) break;
      const next = inLine[i + 1];
      const value = next?.value === tile.value ? tile.value * 2 : tile.value;
      const index = reverse ? SIZE - 1 - slot : slot;
      const place = vertical ? { row: index, col: line } : { row: line, col: index };
      if (place.row !== tile.row || place.col !== tile.col || next?.value === tile.value)
        moved = true;
      if (next?.value === tile.value) {
        out.push({ id: nextId++, value, ...place, merged: true });
        gained += value;
        i++; // the pair is used up
      } else {
        out.push({ id: tile.id, value, ...place });
      }
      slot++;
    }
  }
  return moved ? { tiles: out, score: snapshot.score + gained, rng: snapshot.rng, nextId } : null;
}

const canMove = (snapshot: Snapshot) =>
  (["up", "down", "left", "right"] as const).some((d) => slide(snapshot, d) !== null);

const snapshotOf = (s: State): Snapshot => ({
  tiles: s.tiles,
  score: s.score,
  rng: s.rng,
  nextId: s.nextId,
});

export const engine: RaceEngine<State, Action> = {
  initialState(_config, seed) {
    const start = spawn(spawn({ tiles: [], score: 0, rng: seedRng(seed), nextId: 1 }));
    return {
      ...start,
      moves: 0,
      won: false,
      continued: false,
      over: false,
      undo: null,
      undoUsed: false,
    };
  },

  apply(state, action) {
    if (action.type === "continue")
      return state.won && !state.continued ? { ...state, continued: true } : state;
    if (action.type === "undo") {
      if (!state.undo || state.undoUsed) return state;
      return { ...state, ...state.undo, over: false, undo: null, undoUsed: true };
    }
    if (state.over || (state.won && !state.continued)) return state;
    const slid = slide(snapshotOf(state), action.direction);
    if (!slid) return state;
    const next = spawn(slid);
    return {
      ...next,
      moves: state.moves + 1,
      won: state.won || next.tiles.some((t) => t.value >= GOAL),
      continued: state.continued,
      over: !canMove(next),
      undo: state.undoUsed ? null : snapshotOf(state),
      undoUsed: state.undoUsed,
    };
  },

  progress(state) {
    const best = Math.max(...state.tiles.map((t) => t.value));
    return Math.min(1, Math.log2(best) / Math.log2(GOAL));
  },

  result(state): GameResult | null {
    return state.over ? { score: state.score, completed: state.won } : null;
  },
};

export const bestTile = (state: State) => Math.max(...state.tiles.map((t) => t.value));
