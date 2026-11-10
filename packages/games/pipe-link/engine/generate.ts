// Pipe Link puzzles: a random path through every cell (a zigzag shuffled by
// "backbite" moves), cut into pipes of three cells or more; each pipe's two
// ends become a pair of dots. A solver counts the ways to join every pair
// and fill the board, and only a puzzle with exactly one is kept. Pure.
import { Rng } from "@kefche/game-sdk";

const neighboursOf = (cell: number, size: number) => {
  const r = Math.floor(cell / size);
  const c = cell % size;
  const out: number[] = [];
  if (r > 0) out.push(cell - size);
  if (r < size - 1) out.push(cell + size);
  if (c > 0) out.push(cell - 1);
  if (c < size - 1) out.push(cell + 1);
  return out;
};

/** A Hamiltonian path over the grid, shuffled from a zigzag. */
function randomPath(size: number, rng: Rng): number[] {
  const path: number[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) path.push(r * size + (r % 2 === 0 ? c : size - 1 - c));
  }
  const n = size * size;
  for (let step = 0; step < n * 30; step++) {
    // Backbite: join an end to a neighbour on the path and reverse the part after it.
    if (rng.next() < 0.5) path.reverse();
    const end = path.at(-1) ?? 0;
    const options = neighboursOf(end, size).filter((x) => x !== path.at(-2));
    const pick = rng.pick(options);
    const at = path.indexOf(pick);
    const tail = path.splice(at + 1).reverse();
    path.push(...tail);
  }
  return path;
}

/** Cuts a path into pipes of at least three cells. */
function cut(path: number[], pipes: number, rng: Rng): number[][] | null {
  const n = path.length;
  if (pipes * 3 > n) return null;
  const cuts = new Set<number>();
  let tries = 0;
  while (cuts.size < pipes - 1 && tries < 500) {
    tries++;
    const at = rng.int(3, n - 3);
    if ([...cuts].every((c) => Math.abs(c - at) >= 3)) cuts.add(at);
  }
  if (cuts.size < pipes - 1) return null;
  const sorted = [...cuts].sort((a, b) => a - b);
  const out: number[][] = [];
  let from = 0;
  for (const c of [...sorted, n]) {
    out.push(path.slice(from, c));
    from = c;
  }
  return out;
}

/**
 * How many ways (0, 1 or "2 or more") the dots can be joined to fill the
 * board, within a search budget; null when the budget runs out first.
 */
export function countSolutions(
  size: number,
  ends: readonly (readonly [number, number])[],
  budget = 60_000,
): number | null {
  const n = size * size;
  const colour = new Int8Array(n).fill(-1);
  const isEnd = new Int8Array(n).fill(-1);
  ends.forEach(([a, b], k) => {
    colour[a] = k;
    colour[b] = k;
    isEnd[a] = k;
    isEnd[b] = k;
  });
  // Grow each pipe from its first dot; `heads[k]` is where it has got to.
  const heads = ends.map(([a]) => a);
  const done = ends.map(() => false);
  let nodes = 0;
  let found = 0;
  const target = ends.map(([, b]) => b);
  const filled = () => colour.every((v) => v >= 0);
  // A pipe's head can't move: dead end, unless it's finished.
  const stuck = (k: number) => {
    if (done[k]) return false;
    const h = heads[k] ?? 0;
    return !neighboursOf(h, size).some((x) => colour[x] === -1 || x === target[k]);
  };
  // Every unfinished pipe can still reach its dot through empty cells, and
  // every empty cell can still be reached by some unfinished pipe.
  const open = (): boolean => {
    const reached = new Uint8Array(n);
    for (let k = 0; k < ends.length; k++) {
      if (done[k]) continue;
      const seen = new Uint8Array(n);
      const stack = [heads[k] ?? 0];
      seen[heads[k] ?? 0] = 1;
      let hit = false;
      while (stack.length > 0) {
        const at = stack.pop() ?? 0;
        for (const y of neighboursOf(at, size)) {
          if (y === target[k]) hit = true;
          if (seen[y] || colour[y] !== -1) continue;
          seen[y] = 1;
          reached[y] = 1;
          stack.push(y);
        }
      }
      if (!hit) return false;
    }
    for (let x = 0; x < n; x++) if (colour[x] === -1 && !reached[x]) return false;
    return true;
  };
  const search = (): boolean => {
    if (++nodes > budget) return true;
    if (done.every(Boolean)) {
      if (filled()) found++;
      return found >= 2;
    }
    // The pipe with the fewest ways forward.
    let best = -1;
    let bestMoves: number[] = [];
    for (let k = 0; k < ends.length; k++) {
      if (done[k]) continue;
      const h = heads[k] ?? 0;
      const moves = neighboursOf(h, size).filter((x) => colour[x] === -1 || x === target[k]);
      if (moves.length === 0) return false;
      if (best < 0 || moves.length < bestMoves.length) {
        best = k;
        bestMoves = moves;
      }
    }
    if (best < 0) return false;
    const k = best;
    const from = heads[k] ?? 0;
    for (const x of bestMoves) {
      if (x === target[k]) {
        done[k] = true;
        heads[k] = x;
        if (search()) return true;
        done[k] = false;
        heads[k] = from;
        continue;
      }
      // Don't run alongside your own pipe (it would make a needless loop).
      if (
        neighboursOf(x, size).some(
          (y) => y !== from && colour[y] === k && isEnd[y] !== k && y !== target[k],
        )
      )
        continue;
      colour[x] = k;
      heads[k] = x;
      if (!ends.some((_, j) => stuck(j)) && open() && search()) return true;
      colour[x] = -1;
      heads[k] = from;
    }
    return false;
  };
  search();
  if (nodes > budget) return null;
  return Math.min(found, 2);
}

export interface Puzzle {
  size: number;
  /** Each pair of dots, by colour. */
  ends: [number, number][];
  /** The one solution: each colour's pipe from its first dot. */
  pipes: number[][];
}

// Longer pipes leave more ways to fill the board: from 9 × 9 up, a puzzle with
// one solution is rare unless the pipes are shorter (about 7 cells).
export const pipesFor = (size: number) =>
  size >= 9 ? Math.round((size * size) / 7) : Math.max(3, Math.round(size * 0.9));

export function makePuzzle(seed: string, size: number): Puzzle {
  let fallback: Puzzle | null = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = Rng.fromSeed(`${seed}:pipes:${String(size)}:${String(attempt)}`);
    const pipes = cut(randomPath(size, rng), pipesFor(size), rng);
    if (!pipes) continue;
    const ends = pipes.map((p) => [p[0] ?? 0, p.at(-1) ?? 0] as [number, number]);
    const puzzle = { size, ends, pipes };
    fallback ??= puzzle;
    if (countSolutions(size, ends) === 1) return puzzle;
  }
  return fallback ?? { size, ends: [], pipes: [] };
}
