// A fast Go board for random playouts: the bots' search and the engine's
// estimate of which stones are dead. Typed arrays and no allocation per move.
// Colours: 0 black, 1 white, -1 empty. Pure and deterministic, given the
// random numbers it's handed.

export const EMPTY = -1;

export class FastBoard {
  readonly size: number;
  readonly cells: Int8Array;
  /** The point where a stone can't be played next (simple ko), or -1. */
  ko = -1;
  /** Stones each colour has captured. */
  readonly captures = [0, 0];
  private readonly neighbours: Int16Array[];
  private readonly mark: Int32Array;
  private stamp = 0;
  private readonly stack: Int16Array;

  constructor(size: number, cells?: ArrayLike<number>) {
    this.size = size;
    const n = size * size;
    this.cells = new Int8Array(n).fill(EMPTY);
    if (cells) for (let i = 0; i < n; i++) this.cells[i] = cells[i] ?? EMPTY;
    this.neighbours = neighbourTable(size);
    this.mark = new Int32Array(n);
    this.stack = new Int16Array(n);
  }

  clone(): FastBoard {
    const copy = new FastBoard(this.size, this.cells);
    copy.ko = this.ko;
    copy.captures[0] = this.captures[0] ?? 0;
    copy.captures[1] = this.captures[1] ?? 0;
    return copy;
  }

  around(point: number): Int16Array {
    return this.neighbours[point] ?? new Int16Array();
  }

  /** Whether the group on `point` has a liberty (stops at the first). */
  private hasLiberty(point: number): boolean {
    const colour = this.cells[point];
    const id = ++this.stamp;
    let top = 0;
    this.stack[top++] = point;
    this.mark[point] = id;
    while (top > 0) {
      const p = this.stack[--top] ?? 0;
      for (const q of this.around(p)) {
        const c = this.cells[q];
        if (c === EMPTY) return true;
        if (c === colour && this.mark[q] !== id) {
          this.mark[q] = id;
          this.stack[top++] = q;
        }
      }
    }
    return false;
  }

  /** Removes the group on `point`; returns how many stones it had. */
  private removeGroup(point: number): number {
    const colour = this.cells[point];
    let top = 0;
    let removed = 0;
    this.stack[top++] = point;
    this.cells[point] = EMPTY;
    while (top > 0) {
      const p = this.stack[--top] ?? 0;
      removed++;
      for (const q of this.around(p)) {
        if (this.cells[q] === colour) {
          this.cells[q] = EMPTY;
          this.stack[top++] = q;
        }
      }
    }
    return removed;
  }

  /**
   * Plays `colour` on `point` if legal (empty, not the ko point, not
   * suicide), capturing what it surrounds. Returns false and changes nothing
   * when the move is illegal.
   */
  play(point: number, colour: number): boolean {
    if (this.cells[point] !== EMPTY || point === this.ko) return false;
    const other = 1 - colour;
    this.cells[point] = colour;
    let taken = 0;
    let takenAt = -1;
    for (const q of this.around(point)) {
      if (this.cells[q] === other && !this.hasLiberty(q)) {
        const n = this.removeGroup(q);
        taken += n;
        takenAt = q;
      }
    }
    if (taken === 0 && !this.hasLiberty(point)) {
      this.cells[point] = EMPTY;
      return false;
    }
    this.captures[colour] = (this.captures[colour] ?? 0) + taken;
    // Simple ko: one stone took one stone, and stands alone with one liberty.
    this.ko = -1;
    if (taken === 1) {
      let alone = true;
      let liberties = 0;
      for (const q of this.around(point)) {
        const c = this.cells[q];
        if (c === colour) alone = false;
        else if (c === EMPTY) liberties++;
      }
      if (alone && liberties === 1) this.ko = takenAt;
    }
    return true;
  }

  /** Whether playing `point` is legal for `colour`, without playing it. */
  isLegal(point: number, colour: number): boolean {
    if (this.cells[point] !== EMPTY || point === this.ko) return false;
    for (const q of this.around(point)) if (this.cells[q] === EMPTY) return true;
    const copy = this.clone();
    return copy.play(point, colour);
  }

  /**
   * A point `colour` shouldn't fill in a playout: every neighbour its own,
   * and the diagonals not the other colour's (one is allowed in the middle).
   */
  isEye(point: number, colour: number): boolean {
    if (this.cells[point] !== EMPTY) return false;
    for (const q of this.around(point)) if (this.cells[q] !== colour) return false;
    const size = this.size;
    const r = Math.floor(point / size);
    const c = point % size;
    let bad = 0;
    let edge = false;
    for (const [dr, dc] of DIAGONALS) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) {
        edge = true;
        continue;
      }
      if (this.cells[rr * size + cc] === 1 - colour) bad++;
    }
    return edge ? bad === 0 : bad <= 1;
  }

  /**
   * Plays at random from here until both sides pass, never filling one's
   * own eyes. `random()` gives numbers in [0, 1). Returns the area each
   * colour holds at the end (stones and the empty points only it surrounds).
   */
  playout(colour: number, random: () => number, maxMoves: number): [number, number] {
    const n = this.size * this.size;
    const order = new Int16Array(n);
    let passes = 0;
    let turn = colour;
    for (let move = 0; move < maxMoves && passes < 2; move++) {
      let count = 0;
      for (let p = 0; p < n; p++) if (this.cells[p] === EMPTY) order[count++] = p;
      let played = false;
      while (count > 0) {
        const i = Math.floor(random() * count);
        const p = order[i] ?? 0;
        order[i] = order[--count] ?? 0;
        if (!this.isEye(p, turn) && this.play(p, turn)) {
          played = true;
          break;
        }
      }
      passes = played ? 0 : passes + 1;
      if (!played) this.ko = -1;
      turn = 1 - turn;
    }
    return this.area();
  }

  /** Stones on the board and the empty points next only to one colour's stones. */
  area(): [number, number] {
    const totals: [number, number] = [0, 0];
    const n = this.size * this.size;
    for (let p = 0; p < n; p++) {
      const c = this.cells[p];
      if (c === 0 || c === 1) {
        totals[c]++;
        continue;
      }
      let owner = -2;
      for (const q of this.around(p)) {
        const d = this.cells[q] ?? EMPTY;
        if (d === EMPTY) continue;
        if (owner === -2) owner = d;
        else if (owner !== d) owner = -1;
      }
      if (owner === 0 || owner === 1) totals[owner]++;
    }
    return totals;
  }
}

const DIAGONALS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

const tables = new Map<number, Int16Array[]>();
function neighbourTable(size: number): Int16Array[] {
  const known = tables.get(size);
  if (known) return known;
  const table = Array.from({ length: size * size }, (_, p) => {
    const r = Math.floor(p / size);
    const c = p % size;
    const list: number[] = [];
    if (r > 0) list.push(p - size);
    if (r < size - 1) list.push(p + size);
    if (c > 0) list.push(p - 1);
    if (c < size - 1) list.push(p + 1);
    return Int16Array.from(list);
  });
  tables.set(size, table);
  return table;
}

/** Groups of stones, each as its points, in board order of their first point. */
export function groups(cells: ArrayLike<number>, size: number): number[][] {
  const seen = new Uint8Array(size * size);
  const table = neighbourTable(size);
  const out: number[][] = [];
  for (let p = 0; p < size * size; p++) {
    const colour = cells[p];
    if (colour === EMPTY || colour === undefined || seen[p]) continue;
    const group: number[] = [];
    const stack = [p];
    seen[p] = 1;
    while (stack.length > 0) {
      const q = stack.pop() ?? 0;
      group.push(q);
      for (const r of table[q] ?? []) {
        if (!seen[r] && cells[r] === colour) {
          seen[r] = 1;
          stack.push(r);
        }
      }
    }
    out.push(group);
  }
  return out;
}

/**
 * Who owns each point once the dead stones are off (Japanese counting):
 * a stone's colour, or for an empty point the one colour around its region
 * (-1 when both border it, or none).
 */
export function territory(
  cells: ArrayLike<number>,
  size: number,
  dead: ReadonlySet<number>,
): Int8Array {
  const n = size * size;
  const live = new Int8Array(n);
  for (let p = 0; p < n; p++) live[p] = dead.has(p) ? EMPTY : (cells[p] ?? EMPTY);
  const owner = new Int8Array(n).fill(-1);
  const seen = new Uint8Array(n);
  const table = neighbourTable(size);
  for (let p = 0; p < n; p++) {
    if (live[p] !== EMPTY) {
      owner[p] = live[p] ?? -1;
      continue;
    }
    if (seen[p]) continue;
    const region: number[] = [];
    const stack = [p];
    seen[p] = 1;
    let border = -2;
    while (stack.length > 0) {
      const q = stack.pop() ?? 0;
      region.push(q);
      for (const r of table[q] ?? []) {
        const c = live[r] ?? EMPTY;
        if (c === EMPTY) {
          if (!seen[r]) {
            seen[r] = 1;
            stack.push(r);
          }
        } else if (border === -2) border = c;
        else if (border !== c) border = -1;
      }
    }
    const who = border === 0 || border === 1 ? border : -1;
    for (const q of region) owner[q] = who;
  }
  return owner;
}
