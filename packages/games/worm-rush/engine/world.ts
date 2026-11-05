// Worm Rush's world: worms that steer toward where their player points, grow
// by eating glowing orbs, can boost by spending length, and are knocked out
// when their head touches another worm or the arena's edge, leaving their
// length behind as orbs. Positions are kept in quarter units (what the wire
// carries), so a body rebuilt from snapshots matches the server's exactly.
import type { GameResult, RngState, SpatialGrid } from "@kefche/game-sdk";

export const TICKS_PER_SECOND = 30;
export const SNAPSHOTS_PER_SECOND = 15;
/** A body point is laid down every snapshot tick. */
export const TRAIL_EVERY = TICKS_PER_SECOND / SNAPSHOTS_PER_SECOND;
export const ARENA_RADIUS = 3000;
export const CAPACITY = 30;
/** Positions on the wire are whole quarter units. */
export const POSITION_SCALE = 4;

export const START_MASS = 20;
/** Boosting stops below this. */
export const BOOST_MIN_MASS = 15;
const BOOST_MASS_PER_SECOND = 5;
export const BOOST_MASS_PER_TICK = BOOST_MASS_PER_SECOND / TICKS_PER_SECOND;
export const SPEED_PER_TICK = 150 / TICKS_PER_SECOND;
export const BOOST_SPEED_PER_TICK = 280 / TICKS_PER_SECOND;

/** Orbs the arena keeps scattered, and the most there can be with dropped ones. */
export const NATURAL_ORBS = 1000;
export const MAX_ORBS = 2500;
/** What a knocked-out worm leaves behind, as a share of its mass. */
export const DROP_SHARE = 0.7;
/** The most orbs a knocked-out worm turns into. */
export const MAX_DROPS = 60;
/** A body point hit counts within this share of the head's radius (forgiving near misses). */
export const HIT_SHARE = 0.8;
/** Eating reaches this far past the head and the orb. */
export const SUCTION = 6;
/** Grid cells: about the largest head-and-body reach. */
export const CELL_SIZE = 120;

/** How long a worm's body is, along its path. */
export const wormLength = (mass: number): number => 100 + 40 * Math.sqrt(mass);
/** How thick it is: bigger worms are wider. */
export const wormRadius = (mass: number): number => 8 + 2 * Math.sqrt(Math.sqrt(mass));
/** Radians a tick: bigger worms turn wider. */
export const turnPerTick = (mass: number): number => 3.8 / (1 + mass / 2000) / TICKS_PER_SECOND;
/** How far a player sees: farther as their worm grows. */
export const viewRadius = (mass: number): number => 900 + 0.25 * wormLength(mass);
export const orbRadius = (value: number): number => Math.min(14, 3 + 2 * Math.sqrt(value));
/** The widest worm there can be, for grid queries. */
export const MAX_WORM_RADIUS = wormRadius(100_000);

export const quantize = (v: number): number => Math.round(v * POSITION_SCALE) / POSITION_SCALE;

export interface Worm {
  id: number;
  name: string;
  look: number;
  bot: boolean;
  alive: boolean;
  /** Head, in quarter units. */
  x: number;
  y: number;
  heading: number;
  /** Where the player points. */
  target: number;
  boosting: boolean;
  mass: number;
  /** Boost spent but not yet taken off the mass (it's taken a whole unit at a time). */
  boostDebt: number;
  /** Body points, newest first, as x, y pairs (quarter units). */
  trail: number[];
  /** This life: the most mass, knockouts, the tick it began. */
  best: number;
  kills: number;
  bornTick: number;
  /** Who knocked it out (null for the edge), while out of play. */
  by: number | null;
  /** The life that just ended. */
  lastLife: GameResult | null;
}

export interface Orb {
  id: number;
  x: number;
  y: number;
  value: number;
  /** One of the orb colours (renderer palette). */
  hue: number;
  natural: boolean;
}

export interface Knockout {
  tick: number;
  victim: number;
  by: number | null;
}

export interface World {
  rng: RngState;
  tick: number;
  worms: Map<number, Worm>;
  nextWorm: number;
  orbs: Map<number, Orb>;
  nextOrb: number;
  naturalOrbs: number;
  /** Recent knockouts, for the feed (kept a second). */
  knockouts: Knockout[];
  /** Body points and heads by worm id, rebuilt every tick (collisions, bots, view). */
  bodies: SpatialGrid;
  /** Orbs by id, rebuilt every tick. */
  orbGrid: SpatialGrid;
}

export const ORB_HUES = 6;

/**
 * Drops body points past `length` along the path from the head, keeping one
 * point beyond it so the body reaches its full length. The arena server and
 * the snapshot decoder both call it, on the same quarter-unit points.
 */
export function trimTrail(headX: number, headY: number, trail: number[], length: number): void {
  let travelled = 0;
  let px = headX;
  let py = headY;
  for (let i = 0; i < trail.length; i += 2) {
    const x = trail[i] ?? 0;
    const y = trail[i + 1] ?? 0;
    travelled += Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
    if (travelled >= length) {
      trail.length = i + 2;
      return;
    }
    px = x;
    py = y;
  }
}
