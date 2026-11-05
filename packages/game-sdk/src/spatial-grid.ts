// A uniform grid over the world (SPEC §10.8): finds what is near a point
// without checking everything, for area of interest (what each player is
// sent) and collisions. Rebuilt every tick: clear(), then insert() each
// entity. Results come in a fixed order, so engines using it stay
// deterministic.

const OFFSET = 32768; // cell coordinates are kept in 16 bits each

export class SpatialGrid {
  private readonly cells = new Map<number, number[]>();
  private readonly ids: number[] = [];
  private readonly xs: number[] = [];
  private readonly ys: number[] = [];

  /** `cellSize`: about the radius of the largest query, in world units. */
  constructor(readonly cellSize: number) {}

  clear(): void {
    for (const cell of this.cells.values()) cell.length = 0;
    this.ids.length = 0;
    this.xs.length = 0;
    this.ys.length = 0;
  }

  insert(id: number, x: number, y: number): void {
    const key = this.key(this.cell(x), this.cell(y));
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(this.ids.length);
    this.ids.push(id);
    this.xs.push(x);
    this.ys.push(y);
  }

  /** Ids within `radius` of (x, y), added to `out`, which is returned. */
  query(x: number, y: number, radius: number, out: number[] = []): number[] {
    const r2 = radius * radius;
    const x0 = this.cell(x - radius);
    const x1 = this.cell(x + radius);
    const y0 = this.cell(y - radius);
    const y1 = this.cell(y + radius);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const cell = this.cells.get(this.key(cx, cy));
        if (!cell) continue;
        for (const i of cell) {
          const dx = (this.xs[i] ?? 0) - x;
          const dy = (this.ys[i] ?? 0) - y;
          if (dx * dx + dy * dy <= r2) out.push(this.ids[i] ?? -1);
        }
      }
    }
    return out;
  }

  private cell(v: number): number {
    return Math.floor(v / this.cellSize);
  }

  private key(cx: number, cy: number): number {
    return ((cx + OFFSET) & 0xffff) * 0x10000 + ((cy + OFFSET) & 0xffff);
  }
}
