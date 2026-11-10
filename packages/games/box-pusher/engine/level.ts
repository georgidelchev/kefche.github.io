// Box Pusher levels: a room carved at random from the seed, its boxes set on
// their goals, and a search played backwards from there. Pulling a box is
// pushing it in reverse, so a breadth-first search of pulls from the solved
// position reaches only positions that can be solved, and the number of
// pulls to each is exactly the fewest pushes that solve it. The level starts
// from the farthest one: the solver and the grader in one search. Pure and
// deterministic.
import { Rng } from "@kefche/game-sdk";

export interface Level {
  width: number;
  height: number;
  /** 1 where the player can walk (inside the walls). */
  floor: number[];
  goals: number[];
  boxes: number[];
  player: number;
  /** The fewest pushes that solve it. */
  pushes: number;
}

export interface LevelSpec {
  /** Inside size of the room, walls not counted. */
  inner: number;
  boxes: number;
  /** Share of the inside turned to wall before dead ends are filled. */
  walls: number;
  /** A level needs at least this many pushes; the best of the rooms tried is kept. */
  minPushes: number;
  rooms: number;
  /** Search states per room. */
  budget: number;
}

const flood = (
  floor: Uint8Array,
  blocked: Uint8Array,
  from: number,
  w: number,
  seen: Uint8Array,
) => {
  seen.fill(0);
  const stack = [from];
  seen[from] = 1;
  let min = from;
  while (stack.length > 0) {
    const at = stack.pop() ?? 0;
    for (const y of [at - w, at + w, at - 1, at + 1]) {
      if (seen[y] || !floor[y] || blocked[y]) continue;
      seen[y] = 1;
      if (y < min) min = y;
      stack.push(y);
    }
  }
  return min;
};

/** A room: walls placed at random while the floor stays in one piece, then dead ends filled. */
function carve(spec: LevelSpec, rng: Rng): Uint8Array {
  const w = spec.inner + 2;
  const floor = new Uint8Array(w * w);
  const inside: number[] = [];
  for (let r = 1; r <= spec.inner; r++)
    for (let c = 1; c <= spec.inner; c++) inside.push(r * w + c);
  for (const x of inside) floor[x] = 1;
  const none = new Uint8Array(w * w);
  const seen = new Uint8Array(w * w);
  const count = () => floor.reduce((a, v) => a + v, 0);
  const whole = () => {
    const first = floor.indexOf(1);
    if (first < 0) return false;
    flood(floor, none, first, w, seen);
    return seen.reduce((a, v) => a + v, 0) === count();
  };
  const target = Math.round(inside.length * spec.walls);
  let placed = 0;
  for (const x of rng.shuffle([...inside])) {
    if (placed >= target) break;
    floor[x] = 0;
    if (whole()) placed++;
    else floor[x] = 1;
  }
  // Dead ends make dull corridors: fill them.
  for (let changed = true; changed;) {
    changed = false;
    for (const x of inside) {
      if (!floor[x]) continue;
      const open = [x - w, x + w, x - 1, x + 1].filter((y) => floor[y]).length;
      if (open <= 1) {
        floor[x] = 0;
        changed = true;
      }
    }
  }
  return floor;
}

/** The farthest solvable position from the room's solved one, by breadth-first pulls. */
function farthest(floor: Uint8Array, w: number, goals: number[], budget: number, rng: Rng) {
  const n = floor.length;
  const k = goals.length;
  const B = 128;
  const encode = (boxes: number[], player: number) => {
    const sorted = [...boxes].sort((a, b) => a - b);
    let key = player;
    for (const b of sorted) key = key * B + b;
    return key;
  };
  const decode = (key: number) => {
    const boxes: number[] = [];
    let rest = key;
    for (let i = 0; i < k; i++) {
      boxes.push(rest % B);
      rest = Math.floor(rest / B);
    }
    return { boxes, player: rest };
  };
  const blocked = new Uint8Array(n);
  const seen = new Uint8Array(n);
  const depth = new Map<number, number>();
  let queue: number[] = [];
  // Solved: boxes on the goals, the player anywhere (one state per free area).
  for (const g of goals) blocked[g] = 1;
  const covered = new Uint8Array(n);
  for (let x = 0; x < n; x++) {
    if (!floor[x] || blocked[x] || covered[x]) continue;
    const min = flood(floor, blocked, x, w, seen);
    for (let y = 0; y < n; y++) if (seen[y]) covered[y] = 1;
    const key = encode(goals, min);
    depth.set(key, 0);
    queue.push(key);
  }
  for (const g of goals) blocked[g] = 0;
  const goalSet = new Set(goals);
  let best: { boxes: number[]; player: number; pushes: number } | null = null;
  let level = 0;
  while (queue.length > 0 && depth.size < budget) {
    const next: number[] = [];
    level++;
    for (const key of queue) {
      const { boxes, player } = decode(key);
      for (const b of boxes) blocked[b] = 1;
      flood(floor, blocked, player, w, seen);
      const reach = seen.slice();
      for (const [i, b] of boxes.entries()) {
        for (const d of [-w, w, -1, 1]) {
          // The player stands beside the box and steps back, pulling it.
          const p1 = b + d;
          const p2 = b + 2 * d;
          if (!reach[p1] || !floor[p2] || blocked[p2]) continue;
          const moved = boxes.map((x, j) => (j === i ? p1 : x));
          blocked[b] = 0;
          blocked[p1] = 1;
          const min = flood(floor, blocked, p2, w, seen);
          blocked[p1] = 0;
          blocked[b] = 1;
          const nk = encode(moved, min);
          if (depth.has(nk)) continue;
          depth.set(nk, level);
          next.push(nk);
        }
      }
      for (const b of boxes) blocked[b] = 0;
    }
    // Keep the deepest layer whose boxes are all off their goals.
    const fresh = next.filter((key) => decode(key).boxes.every((b) => !goalSet.has(b)));
    if (fresh.length > 0) {
      const pickKey = rng.pick(fresh);
      const { boxes, player } = decode(pickKey);
      best = { boxes, player, pushes: level };
    }
    queue = next;
  }
  return best;
}

export function makeLevel(seed: string, spec: LevelSpec): Level {
  let best: Level | null = null;
  for (let room = 0; room < spec.rooms; room++) {
    const rng = Rng.fromSeed(`${seed}:room:${String(room)}`);
    const floor = carve(spec, rng);
    const cells = floor.reduce<number[]>((a, v, i) => (v ? [...a, i] : a), []);
    if (cells.length < spec.boxes * 3 + 4) continue;
    // Goals away from the walls' corners, where a box could never leave.
    const w = spec.inner + 2;
    const free = cells.filter((x) => {
      const up = floor[x - w] ?? 0;
      const down = floor[x + w] ?? 0;
      const left = floor[x - 1] ?? 0;
      const right = floor[x + 1] ?? 0;
      return (up || down) && (left || right);
    });
    if (free.length < spec.boxes) continue;
    const goals = rng.shuffle(free).slice(0, spec.boxes);
    const found = farthest(floor, w, goals, spec.budget, rng);
    if (!found) continue;
    const level: Level = { width: w, height: w, floor: [...floor], goals, ...found };
    if (!best || level.pushes > best.pushes) best = level;
    if (best.pushes >= spec.minPushes) break;
  }
  return best ?? fallback(spec);
}

/** A straight push, should every room fail (not seen in testing). */
function fallback(spec: LevelSpec): Level {
  const w = spec.inner + 2;
  const floor = new Array<number>(w * w).fill(0);
  for (let c = 1; c <= spec.inner; c++) floor[w + c] = 1;
  return {
    width: w,
    height: w,
    floor,
    goals: [w + spec.inner],
    boxes: [w + 2],
    player: w + 1,
    pushes: spec.inner - 2,
  };
}

/** A level as text: # wall, space floor, . goal, $ box, * box on a goal, @ player, + player on a goal. */
export function toText(level: Level): string {
  const { width, floor, goals, boxes, player } = level;
  const rows: string[] = [];
  for (let r = 0; r < level.height; r++) {
    let row = "";
    for (let c = 0; c < width; c++) {
      const x = r * width + c;
      const goal = goals.includes(x);
      if (!floor[x]) row += "#";
      else if (boxes.includes(x)) row += goal ? "*" : "$";
      else if (x === player) row += goal ? "+" : "@";
      else row += goal ? "." : " ";
    }
    rows.push(row);
  }
  return rows.join("\n");
}

export function fromText(text: string, pushes: number): Level {
  const rows = text.split("\n");
  const width = Math.max(...rows.map((r) => r.length));
  const floor: number[] = [];
  const goals: number[] = [];
  const boxes: number[] = [];
  let player = 0;
  rows.forEach((row, r) => {
    for (let c = 0; c < width; c++) {
      const ch = row[c] ?? "#";
      const x = r * width + c;
      floor.push(ch === "#" ? 0 : 1);
      if (ch === "." || ch === "*" || ch === "+") goals.push(x);
      if (ch === "$" || ch === "*") boxes.push(x);
      if (ch === "@" || ch === "+") player = x;
    }
  });
  return { width, height: rows.length, floor, goals, boxes, player, pushes };
}
