// Grades a puzzle by the techniques a person needs to solve it (SPEC §20.3
// #21). A logic solver applies the simplest technique that makes progress,
// again and again; the hardest one it had to use is the grade.
import { candidatesOf, colOf, count, digits, PEERS, rowOf, boxOf, UNITS } from "./board";

export const LEVEL = {
  /** Naked and hidden singles. */
  singles: 0,
  /** Pointing and claiming (locked candidates). */
  locked: 1,
  /** Naked pairs and triples, hidden pairs. */
  subsets: 2,
  /** X-wing. */
  fish: 3,
  /** Needs more than the techniques above (chains, trial and error). */
  beyond: 4,
} as const;
export type Level = (typeof LEVEL)[keyof typeof LEVEL];

class LogicSolver {
  readonly cells: number[];
  readonly cand: number[];

  constructor(grid: readonly number[]) {
    this.cells = [...grid];
    this.cand = this.cells.map((v, c) => (v ? 0 : candidatesOf(this.cells, c)));
  }

  get solved() {
    return !this.cells.includes(0);
  }

  get stuck() {
    return this.cells.some((v, c) => !v && !this.cand[c]);
  }

  place(cell: number, digit: number) {
    this.cells[cell] = digit;
    this.cand[cell] = 0;
    for (const peer of PEERS[cell] ?? []) this.cand[peer] = (this.cand[peer] ?? 0) & ~(1 << digit);
  }

  /** Removes `mask` from the cells; true when something changed. */
  eliminate(cells: Iterable<number>, mask: number): boolean {
    let changed = false;
    for (const c of cells) {
      const before = this.cand[c] ?? 0;
      if (before & mask) {
        this.cand[c] = before & ~mask;
        changed = true;
      }
    }
    return changed;
  }

  /** Empty cells of a unit where `digit` is still possible. */
  places(unit: readonly number[], digit: number): number[] {
    return unit.filter((c) => (this.cand[c] ?? 0) & (1 << digit));
  }

  nakedSingle(): boolean {
    for (let c = 0; c < 81; c++) {
      const mask = this.cand[c] ?? 0;
      if (!this.cells[c] && count(mask) === 1) {
        this.place(c, digits(mask)[0] ?? 0);
        return true;
      }
    }
    return false;
  }

  hiddenSingle(): boolean {
    for (const unit of UNITS) {
      for (let d = 1; d <= 9; d++) {
        const at = this.places(unit, d);
        if (at.length === 1 && at[0] !== undefined) {
          this.place(at[0], d);
          return true;
        }
      }
    }
    return false;
  }

  /** Pointing (box → line) and claiming (line → box). */
  locked(): boolean {
    for (const unit of UNITS) {
      for (let d = 1; d <= 9; d++) {
        const at = this.places(unit, d);
        if (at.length < 2) continue;
        for (const unitOf of [rowOf, colOf, boxOf]) {
          const first = unitOf(at[0] ?? 0);
          if (!at.every((c) => unitOf(c) === first)) continue;
          // Every place for d in this unit lies in one other unit too, so d
          // can't go anywhere else in that other unit.
          const other = UNITS.find((u) => u !== unit && u.every((c) => unitOf(c) === first));
          if (!other) continue;
          if (
            this.eliminate(
              other.filter((c) => !at.includes(c)),
              1 << d,
            )
          )
            return true;
        }
      }
    }
    return false;
  }

  /** Naked pairs and triples, hidden pairs. */
  subsets(): boolean {
    for (const unit of UNITS) {
      const empty = unit.filter((c) => !this.cells[c]);
      for (const size of [2, 3]) {
        for (const group of combinations(empty, size)) {
          const union = group.reduce((m, c) => m | (this.cand[c] ?? 0), 0);
          if (count(union) !== size) continue;
          if (
            this.eliminate(
              empty.filter((c) => !group.includes(c)),
              union,
            )
          )
            return true;
        }
      }
      for (const [a, b] of combinations([1, 2, 3, 4, 5, 6, 7, 8, 9], 2) as [number, number][]) {
        const at = this.places(unit, a);
        const bt = this.places(unit, b);
        if (at.length !== 2 || bt.length !== 2 || at.some((c) => !bt.includes(c))) continue;
        const keep = (1 << a) | (1 << b);
        let changed = false;
        for (const c of at) {
          const before = this.cand[c] ?? 0;
          if (before & ~keep) {
            this.cand[c] = before & keep;
            changed = true;
          }
        }
        if (changed) return true;
      }
    }
    return false;
  }

  /** X-wing on rows and on columns. */
  fish(): boolean {
    const lines = [UNITS.slice(0, 9), UNITS.slice(9, 18)];
    for (const [base, cross] of [
      [lines[0], colOf],
      [lines[1], rowOf],
    ] as const) {
      if (!base) continue;
      for (let d = 1; d <= 9; d++) {
        const pairs = base
          .map((line) => this.places(line, d))
          .filter((at) => at.length === 2)
          .map((at) => ({ at, key: at.map(cross).join() }));
        for (const [p, q] of combinations(pairs, 2) as [(typeof pairs)[0], (typeof pairs)[0]][]) {
          if (p.key !== q.key) continue;
          const crossLines = p.at.map(cross);
          const targets: number[] = [];
          for (let c = 0; c < 81; c++) {
            if (crossLines.includes(cross(c)) && !p.at.includes(c) && !q.at.includes(c)) {
              targets.push(c);
            }
          }
          if (this.eliminate(targets, 1 << d)) return true;
        }
      }
    }
    return false;
  }
}

function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  const out: T[][] = [];
  items.forEach((item, i) => {
    for (const rest of combinations(items.slice(i + 1), size - 1)) out.push([item, ...rest]);
  });
  return out;
}

/**
 * Solves `grid` by logic alone: the hardest technique it needed and the
 * cells it filled (all of them unless the level is `beyond`).
 */
export function solveByLogic(grid: readonly number[]): { level: Level; cells: number[] } {
  const solver = new LogicSolver(grid);
  let level: Level = LEVEL.singles;
  for (;;) {
    if (solver.solved) return { level, cells: solver.cells };
    if (solver.stuck) return { level: LEVEL.beyond, cells: solver.cells };
    if (solver.nakedSingle() || solver.hiddenSingle()) continue;
    if (solver.locked()) level = Math.max(level, LEVEL.locked) as Level;
    else if (solver.subsets()) level = Math.max(level, LEVEL.subsets) as Level;
    else if (solver.fish()) level = Math.max(level, LEVEL.fish) as Level;
    else return { level: LEVEL.beyond, cells: solver.cells };
  }
}

/** The hardest technique needed to solve `grid` by logic alone. */
export const grade = (grid: readonly number[]): Level => solveByLogic(grid).level;

/**
 * A cell the player can fill next by logic, with its digit: the first naked
 * or hidden single on the current board. Used for hints.
 */
export function nextSingle(grid: readonly number[]): { cell: number; digit: number } | null {
  const solver = new LogicSolver(grid);
  const before = [...solver.cells];
  if (!solver.nakedSingle() && !solver.hiddenSingle()) return null;
  const cell = solver.cells.findIndex((v, c) => v !== before[c]);
  return cell === -1 ? null : { cell, digit: solver.cells[cell] ?? 0 };
}
