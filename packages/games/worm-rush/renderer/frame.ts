// What to draw this frame, from the snapshots (no PixiJS here, so it's
// testable). Everyone else is drawn between the two snapshots around 100 ms
// ago; the player's own worm is drawn where prediction has it now, on the
// latest snapshot's body. Positions here are world units (the engine keeps
// quarter units).

import { byteToAngle } from "@kefche/game-sdk";
import { lerp, lerpAngle, type Bracket, type PredictionModel } from "@kefche/game-sdk/browser";

import {
  moveHead,
  POSITION_SCALE,
  START_MASS,
  viewRadius,
  wormLength,
  wormRadius,
  type Head,
  type Input,
  type Snapshot,
  type SnapshotOrb,
  type SnapshotWorm,
} from "../engine";

export interface FrameWorm {
  id: number;
  name: string;
  look: number;
  self: boolean;
  radius: number;
  heading: number;
  boosting: boolean;
  /** Body points from the head, `spacing` apart, as x, y pairs. */
  body: number[];
}

export interface Frame {
  /** The camera's centre. */
  x: number;
  y: number;
  /** The player's mass (for the zoom), or the start mass while out of play. */
  mass: number;
  worms: FrameWorm[];
  /** In quarter units, as sent. */
  orbs: SnapshotOrb[];
}

/** The player's own head, predicted between snapshots. */
export const headPrediction: PredictionModel<Head, Input> = {
  step(state, input) {
    const next = { ...state };
    moveHead(next, input.heading, input.boost);
    return next;
  },
  blend: (from, to, t) => ({
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    heading: lerpAngle(from.heading, to.heading, t),
    mass: to.mass,
  }),
};

/** The player's head as a snapshot has it, or null when they're not in it. */
export function headOf(snapshot: Snapshot, self: number): Head | null {
  const worm = snapshot.worms.find((w) => w.id === self);
  return worm
    ? { x: worm.x, y: worm.y, heading: byteToAngle(worm.heading), mass: worm.mass }
    : null;
}

/** Spacing of drawn body segments for a worm of `radius`. */
export const segmentSpacing = (radius: number): number => radius * 0.5;

/**
 * Walks the path `points` (quarter units, head first) and writes a point every
 * `spacing` world units into `out`, ending exactly `length` from the head (or
 * at the path's end). Even spacing keeps patterns steady whatever the speed.
 */
export function resampleBody(
  points: number[],
  length: number,
  spacing: number,
  out: number[],
): void {
  out.length = 0;
  let px = (points[0] ?? 0) / POSITION_SCALE;
  let py = (points[1] ?? 0) / POSITION_SCALE;
  out.push(px, py);
  let travelled = 0;
  let next = spacing;
  for (let i = 2; i + 1 < points.length; i += 2) {
    const x = (points[i] ?? 0) / POSITION_SCALE;
    const y = (points[i + 1] ?? 0) / POSITION_SCALE;
    const piece = Math.hypot(x - px, y - py);
    if (piece === 0) continue;
    const end = Math.min(travelled + piece, length);
    while (next <= end) {
      const t = (next - travelled) / piece;
      out.push(px + (x - px) * t, py + (y - py) * t);
      next += spacing;
    }
    if (travelled + piece >= length) {
      const t = (length - travelled) / piece;
      if (next - spacing < length) out.push(px + (x - px) * t, py + (y - py) * t);
      return;
    }
    travelled += piece;
    px = x;
    py = y;
  }
  // A path shorter than the worm (it just joined): it ends where the path does.
  if (travelled > next - spacing) out.push(px, py);
}

const path: number[] = [];

function frameWorm(
  id: number,
  names: Map<number, { name: string; look: number }>,
  head: Head,
  trail: number[],
  boosting: boolean,
  self: boolean,
): FrameWorm {
  path.length = 0;
  path.push(head.x, head.y, ...trail);
  const radius = wormRadius(head.mass);
  const body: number[] = [];
  resampleBody(path, wormLength(head.mass), segmentSpacing(radius), body);
  const known = names.get(id);
  return {
    id,
    name: known?.name ?? "",
    look: known?.look ?? 0,
    self,
    radius,
    heading: head.heading,
    boosting,
    body,
  };
}

const headFrom = (w: SnapshotWorm): Head => ({
  x: w.x,
  y: w.y,
  heading: byteToAngle(w.heading),
  mass: w.mass,
});

/**
 * The frame: others from `bracket` (100 ms back), the player from `latest`
 * with `predicted` as their head (null: drawn as the snapshot has them).
 */
export function buildFrame(
  bracket: Bracket<Snapshot>,
  latest: Snapshot,
  self: number,
  predicted: Head | null,
): Frame {
  const { from, to, alpha } = bracket;
  const names = new Map<number, { name: string; look: number }>();
  for (const n of [...from.names, ...to.names, ...latest.names]) names.set(n.id, n);
  const before = new Map(from.worms.map((w) => [w.id, w]));
  const worms: FrameWorm[] = [];
  for (const w of to.worms) {
    if (w.id === self) continue;
    const f = before.get(w.id);
    if (!f) {
      worms.push(frameWorm(w.id, names, headFrom(w), w.trail, w.boosting, false));
      continue;
    }
    // The older snapshot's body starts where its head was, so the head moves on from there.
    const head: Head = {
      x: lerp(f.x, w.x, alpha),
      y: lerp(f.y, w.y, alpha),
      heading: lerpAngle(byteToAngle(f.heading), byteToAngle(w.heading), alpha),
      mass: lerp(f.mass, w.mass, alpha),
    };
    worms.push(frameWorm(w.id, names, head, f.trail, alpha < 0.5 ? f.boosting : w.boosting, false));
  }
  // The player's own worm on top.
  const mine = latest.self.alive ? latest.worms.find((w) => w.id === self) : undefined;
  let x = latest.self.x / POSITION_SCALE;
  let y = latest.self.y / POSITION_SCALE;
  if (mine) {
    const head = predicted ?? headFrom(mine);
    worms.push(frameWorm(self, names, head, [mine.x, mine.y, ...mine.trail], mine.boosting, true));
    x = head.x / POSITION_SCALE;
    y = head.y / POSITION_SCALE;
  }
  return { x, y, mass: mine ? mine.mass : START_MASS, worms, orbs: to.orbs };
}

/**
 * World units to CSS px: a worm's surroundings fill the screen's shorter side,
 * widening as it grows, but never showing past what the arena sends (its view).
 */
export function cameraZoom(width: number, height: number, mass: number): number {
  const shown = 300 + 0.15 * wormLength(mass);
  const zoom = Math.min(width, height) / 2 / shown;
  return Math.max(zoom, Math.hypot(width, height) / 2 / viewRadius(mass));
}
