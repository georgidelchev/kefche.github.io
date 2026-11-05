// Worm Rush rules (SPEC §20.4 #41), stepped 30 times a second by the arena
// (ArenaHost). Deterministic: randomness only from the world's RngState, and
// trigonometry from det-math, so the same seed, joins and inputs make the
// same world on every engine.
import {
  Rng,
  SpatialGrid,
  angleToByte,
  detAtan2,
  detCos,
  detSin,
  seedRng,
  wrapAngle,
  type ArenaJoiner,
  type GameResult,
} from "@kefche/game-sdk";

import {
  ARENA_RADIUS,
  BOOST_MASS_PER_TICK,
  BOOST_MIN_MASS,
  BOOST_SPEED_PER_TICK,
  CAPACITY,
  CELL_SIZE,
  DROP_SHARE,
  HIT_SHARE,
  MAX_DROPS,
  MAX_ORBS,
  MAX_WORM_RADIUS,
  NATURAL_ORBS,
  ORB_HUES,
  SPEED_PER_TICK,
  START_MASS,
  SUCTION,
  TICKS_PER_SECOND,
  TRAIL_EVERY,
  orbRadius,
  quantize,
  trimTrail,
  turnPerTick,
  viewRadius,
  wormLength,
  wormRadius,
  type Knockout,
  type Orb,
  type World,
  type Worm,
} from "./world";

export interface Input {
  /** Where to head, in radians. */
  heading: number;
  boost: boolean;
}

/** What happened in a tick (sounds, the solo arena's result, the server's records). */
export interface Event {
  type: "knockout";
  victim: number;
  by: number | null;
  mass: number;
}

export interface SnapshotWorm {
  id: number;
  x: number;
  y: number;
  /** One byte: angleToByte. */
  heading: number;
  mass: number;
  boosting: boolean;
  /** Body points, newest first, as x, y pairs. */
  trail: number[];
}

export interface SnapshotOrb {
  id: number;
  x: number;
  y: number;
  value: number;
  hue: number;
}

export interface SnapshotName {
  id: number;
  name: string;
  look: number;
  bot: boolean;
}

/** What one player sees, as the snapshot codec carries it. */
export interface Snapshot {
  self: {
    alive: boolean;
    mass: number;
    best: number;
    kills: number;
    /** 1 for the longest worm in play; 0 while out of play. */
    rank: number;
    /** Worms in play. */
    of: number;
    /** Who knocked them out (0: the edge, or still in play). */
    by: number;
    /** Where the view is centred. */
    x: number;
    y: number;
  };
  /** Worms in view, by id. */
  worms: SnapshotWorm[];
  /** Orbs in view, by id. */
  orbs: SnapshotOrb[];
  /** The 10 longest worms in play. */
  board: { id: number; mass: number }[];
  /** Knockouts since the last snapshot. */
  feed: { victim: number; by: number }[];
  /** Names of every worm the snapshot mentions, by id. */
  names: SnapshotName[];
}

export function createWorld(seed: string): World {
  const world: World = {
    rng: seedRng(seed),
    tick: 0,
    worms: new Map(),
    nextWorm: 1,
    orbs: new Map(),
    nextOrb: 1,
    naturalOrbs: 0,
    knockouts: [],
    bodies: new SpatialGrid(CELL_SIZE),
    orbGrid: new SpatialGrid(CELL_SIZE),
  };
  const rng = new Rng(world.rng);
  while (world.naturalOrbs < NATURAL_ORBS) addNaturalOrb(world, rng);
  world.rng = rng.state;
  rebuildGrids(world);
  return world;
}

export function join(world: World, joiner: ArenaJoiner): number | null {
  if (world.worms.size >= CAPACITY) return null;
  const id = world.nextWorm++;
  const worm: Worm = {
    id,
    name: joiner.name,
    look: joiner.look,
    bot: joiner.bot !== null,
    alive: false,
    x: 0,
    y: 0,
    heading: 0,
    target: 0,
    boosting: false,
    mass: START_MASS,
    boostDebt: 0,
    trail: [],
    best: START_MASS,
    kills: 0,
    bornTick: world.tick,
    by: null,
    lastLife: null,
  };
  world.worms.set(id, worm);
  spawn(world, worm);
  return id;
}

export function leave(world: World, id: number): void {
  // Leaving isn't a knockout: no feed line and no orbs (the arena reads the
  // player's result before they leave).
  world.worms.delete(id);
}

export function respawn(world: World, id: number): boolean {
  const worm = world.worms.get(id);
  if (!worm || worm.alive) return false;
  spawn(world, worm);
  return true;
}

export const alive = (world: World, id: number): boolean => world.worms.get(id)?.alive === true;

export function step(world: World, inputs: ReadonlyMap<number, Input>): Event[] {
  const rng = new Rng(world.rng);
  world.tick++;
  const trailTick = world.tick % TRAIL_EVERY === 0;
  for (const worm of world.worms.values()) {
    if (!worm.alive) continue;
    const input = inputs.get(worm.id);
    if (input) {
      worm.target = input.heading;
      worm.boosting = input.boost;
    }
    move(world, worm, rng);
    if (trailTick) {
      worm.trail.unshift(worm.x, worm.y);
      trimTrail(worm.x, worm.y, worm.trail, wormLength(worm.mass));
    }
  }
  rebuildGrids(world);
  eat(world);
  const events = collide(world);
  // Scattered orbs grow back, a few a tick.
  for (let i = 0; i < 3 && world.naturalOrbs < NATURAL_ORBS && world.orbs.size < MAX_ORBS; i++) {
    addNaturalOrb(world, rng);
  }
  world.knockouts = world.knockouts.filter((k) => k.tick > world.tick - TICKS_PER_SECOND);
  world.rng = rng.state;
  return events;
}

function move(world: World, worm: Worm, rng: Rng): void {
  const turn = turnPerTick(worm.mass);
  const diff = wrapAngle(worm.target - worm.heading);
  worm.heading = wrapAngle(worm.heading + Math.max(-turn, Math.min(turn, diff)));
  const boosting = worm.boosting && worm.mass > BOOST_MIN_MASS;
  const speed = boosting ? BOOST_SPEED_PER_TICK : SPEED_PER_TICK;
  worm.x = quantize(worm.x + detCos(worm.heading) * speed);
  worm.y = quantize(worm.y + detSin(worm.heading) * speed);
  if (boosting) {
    // Boosting burns length, left behind as small orbs at the tail.
    worm.boostDebt += BOOST_MASS_PER_TICK;
    while (worm.boostDebt >= 1 && worm.mass > BOOST_MIN_MASS) {
      worm.boostDebt -= 1;
      worm.mass -= 1;
      const tx = worm.trail.at(-2) ?? worm.x;
      const ty = worm.trail.at(-1) ?? worm.y;
      addOrb(world, tx + rng.int(-6, 6), ty + rng.int(-6, 6), 1, hueOf(worm), false);
    }
  }
}

function eat(world: World): void {
  for (const worm of world.worms.values()) {
    if (!worm.alive) continue;
    const reach = wormRadius(worm.mass) + SUCTION;
    const eaten: number[] = [];
    world.orbGrid.forEach(worm.x, worm.y, reach + 14, (id, _x, _y, d2) => {
      const orb = world.orbs.get(id);
      if (orb && d2 <= (reach + orbRadius(orb.value)) ** 2) eaten.push(id);
    });
    for (const id of eaten) {
      const orb = world.orbs.get(id);
      if (!orb) continue;
      world.orbs.delete(id);
      if (orb.natural) world.naturalOrbs--;
      worm.mass += orb.value;
      worm.best = Math.max(worm.best, worm.mass);
    }
  }
}

function collide(world: World): Event[] {
  const hits: { worm: Worm; by: Worm | null }[] = [];
  for (const worm of world.worms.values()) {
    if (!worm.alive) continue;
    const head = wormRadius(worm.mass);
    if (worm.x * worm.x + worm.y * worm.y >= (ARENA_RADIUS - head) ** 2) {
      hits.push({ worm, by: null });
      continue;
    }
    const found: { by: Worm | null } = { by: null };
    world.bodies.forEach(worm.x, worm.y, head * HIT_SHARE + MAX_WORM_RADIUS, (id, _x, _y, d2) => {
      if (found.by || id === worm.id) return;
      const other = world.worms.get(id);
      if (other?.alive && d2 < (head * HIT_SHARE + wormRadius(other.mass)) ** 2) found.by = other;
    });
    if (found.by) hits.push({ worm, by: found.by });
  }
  // Everyone hit in the same tick goes out together (two heads meeting both go).
  const events: Event[] = [];
  for (const { worm, by } of hits) {
    events.push({ type: "knockout", victim: worm.id, by: by?.id ?? null, mass: worm.mass });
    knockOut(world, worm, by);
  }
  return events;
}

function knockOut(world: World, worm: Worm, by: Worm | null): void {
  worm.alive = false;
  worm.by = by?.id ?? null;
  worm.lastLife = lifeResult(world, worm);
  if (by) by.kills++;
  world.knockouts.push({
    tick: world.tick,
    victim: worm.id,
    by: by?.id ?? null,
  } satisfies Knockout);
  // The body becomes orbs along where it lay.
  const points = worm.trail.length / 2;
  const count = Math.max(1, Math.min(MAX_DROPS, Math.floor(points / 2)));
  const value = Math.max(1, Math.round((worm.mass * DROP_SHARE) / count));
  const rng = new Rng(world.rng);
  for (let i = 0; i < count; i++) {
    const p = Math.floor((i * points) / count) * 2;
    addOrb(
      world,
      (worm.trail[p] ?? worm.x) + rng.int(-8, 8),
      (worm.trail[p + 1] ?? worm.y) + rng.int(-8, 8),
      value,
      hueOf(worm),
      false,
    );
  }
  world.rng = rng.state;
}

function lifeResult(world: World, worm: Worm): GameResult {
  return {
    score: worm.best,
    timeMs: Math.round(((world.tick - worm.bornTick) * 1000) / TICKS_PER_SECOND),
    completed: true,
  };
}

/** A player's result: their last life once it's over, or null while it goes on. */
export function result(world: World, id: number): GameResult | null {
  const worm = world.worms.get(id);
  if (!worm) return null;
  return worm.alive ? lifeResult(world, worm) : worm.lastLife;
}

function spawn(world: World, worm: Worm): void {
  const rng = new Rng(world.rng);
  // A clear spot: the first of a few tries with no body within 300 units.
  let x = 0;
  let y = 0;
  for (let attempt = 0; attempt < 20; attempt++) {
    const angle = rng.next() * Math.PI * 2;
    const r = Math.sqrt(rng.next()) * ARENA_RADIUS * 0.75;
    x = quantize(detCos(angle) * r);
    y = quantize(detSin(angle) * r);
    if (world.bodies.query(x, y, 300).length === 0) break;
  }
  world.rng = rng.state;
  // Facing roughly toward the middle.
  const heading = wrapAngle(detAtan2(-y, -x) + (rng.next() - 0.5));
  Object.assign(worm, {
    alive: true,
    x,
    y,
    heading,
    target: heading,
    boosting: false,
    mass: START_MASS,
    boostDebt: 0,
    trail: [x, y],
    best: START_MASS,
    kills: 0,
    bornTick: world.tick,
    by: null,
  });
}

function rebuildGrids(world: World): void {
  world.bodies.clear();
  for (const worm of world.worms.values()) {
    if (!worm.alive) continue;
    world.bodies.insert(worm.id, worm.x, worm.y);
    for (let i = 0; i < worm.trail.length; i += 2) {
      world.bodies.insert(worm.id, worm.trail[i] ?? 0, worm.trail[i + 1] ?? 0);
    }
  }
  world.orbGrid.clear();
  for (const orb of world.orbs.values()) world.orbGrid.insert(orb.id, orb.x, orb.y);
}

function addNaturalOrb(world: World, rng: Rng): void {
  const angle = rng.next() * Math.PI * 2;
  const r = Math.sqrt(rng.next()) * (ARENA_RADIUS - 40);
  const roll = rng.next();
  const value = roll < 0.6 ? 1 : roll < 0.85 ? 2 : 3;
  if (addOrb(world, detCos(angle) * r, detSin(angle) * r, value, rng.int(0, ORB_HUES - 1), true)) {
    world.naturalOrbs++;
  }
}

function addOrb(
  world: World,
  x: number,
  y: number,
  value: number,
  hue: number,
  natural: boolean,
): boolean {
  if (world.orbs.size >= MAX_ORBS) return false;
  // Inside the arena, a little away from its edge.
  const limit = ARENA_RADIUS - 30;
  const d = Math.sqrt(x * x + y * y);
  const scale = d > limit ? limit / d : 1;
  const orb: Orb = {
    id: world.nextOrb++,
    x: quantize(x * scale),
    y: quantize(y * scale),
    value,
    hue,
    natural,
  };
  world.orbs.set(orb.id, orb);
  return true;
}

const hueOf = (worm: Worm): number => worm.look % ORB_HUES;

/** What participant `id` sees now. */
export function snapshot(world: World, id: number): Snapshot {
  const me = world.worms.get(id);
  const ranked = [...world.worms.values()]
    .filter((w) => w.alive)
    .sort((a, b) => b.mass - a.mass || a.id - b.id);
  const cx = me?.x ?? 0;
  const cy = me?.y ?? 0;
  const view = viewRadius(me?.mass ?? START_MASS);
  const worms: Snapshot["worms"] = [];
  for (const worm of world.worms.values()) {
    if (!worm.alive) continue;
    // In view when any of its body could be: within its length of the edge.
    const reach = view + wormLength(worm.mass) + wormRadius(worm.mass);
    if ((worm.x - cx) ** 2 + (worm.y - cy) ** 2 > reach * reach) continue;
    worms.push({
      id: worm.id,
      x: worm.x,
      y: worm.y,
      heading: angleToByte(worm.heading),
      mass: worm.mass,
      boosting: worm.boosting && worm.mass > BOOST_MIN_MASS,
      trail: [...worm.trail],
    });
  }
  worms.sort((a, b) => a.id - b.id);
  const orbs = world.orbGrid
    .query(cx, cy, view + 20)
    .map((orbId) => world.orbs.get(orbId))
    .filter((orb): orb is Orb => orb !== undefined)
    .map(({ id: orbId, x, y, value, hue }) => ({ id: orbId, x, y, value, hue }))
    .sort((a, b) => a.id - b.id);
  const board = ranked.slice(0, 10).map((w) => ({ id: w.id, mass: w.mass }));
  const feed = world.knockouts
    .filter((k) => k.tick > world.tick - TRAIL_EVERY)
    .map((k) => ({ victim: k.victim, by: k.by ?? 0 }));
  const mentioned = new Set<number>([
    ...worms.map((w) => w.id),
    ...board.map((b) => b.id),
    ...feed.flatMap((f) => (f.by ? [f.victim, f.by] : [f.victim])),
  ]);
  const names = [...mentioned]
    .map((wid) => world.worms.get(wid))
    .filter((w): w is Worm => w !== undefined)
    .map((w) => ({ id: w.id, name: w.name, look: w.look, bot: w.bot }))
    .sort((a, b) => a.id - b.id);
  const rank = me?.alive ? ranked.indexOf(me) + 1 : 0;
  return {
    self: {
      alive: me?.alive === true,
      mass: me?.mass ?? 0,
      best: me?.best ?? 0,
      kills: me?.kills ?? 0,
      rank,
      of: ranked.length,
      by: me?.by ?? 0,
      x: cx,
      y: cy,
    },
    worms,
    orbs,
    board,
    feed,
    names,
  };
}
