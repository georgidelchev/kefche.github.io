// Worm Rush on the wire. A snapshot goes against the previous one the same
// player got: worms already in view send only their head's move, their
// heading and their change in mass, and the reader rebuilds the body the way
// the server built it (the head becomes a new body point, then trimTrail).
// A body goes whole only when a worm comes into view, or whenever the rebuild
// wouldn't match. Orbs don't move: only those coming into or leaving view.
import {
  ByteReader,
  ByteWriter,
  angleToByte,
  byteToAngle,
  type InputCodec,
  type SnapshotCodec,
} from "@kefche/game-sdk";

import { POSITION_SCALE, trimTrail, wormLength } from "./world";

import type { Input, Snapshot, SnapshotName, SnapshotOrb, SnapshotWorm } from "./rules";

const Q = POSITION_SCALE;
const CONTINUING = 1;
const BOOSTING = 2;

/** The body a reader rebuilds for a worm it already had. */
function rebuiltTrail(previous: SnapshotWorm, x: number, y: number, mass: number): number[] {
  const trail = [x, y, ...previous.trail];
  trimTrail(x, y, trail, wormLength(mass));
  return trail;
}

const sameTrail = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

function mentioned(s: Pick<Snapshot, "worms" | "board" | "feed">): Set<number> {
  return new Set([
    ...s.worms.map((w) => w.id),
    ...s.board.map((b) => b.id),
    ...s.feed.flatMap((f) => (f.by ? [f.victim, f.by] : [f.victim])),
  ]);
}

/** Sorted ids as gaps from the one before. */
function writeIds(w: ByteWriter, ids: readonly number[]): void {
  w.varint(ids.length);
  let last = 0;
  for (const id of ids) {
    w.varint(id - last);
    last = id;
  }
}

function readIds(r: ByteReader): number[] {
  const ids: number[] = [];
  let last = 0;
  for (let n = r.varint(); n > 0; n--) {
    last += r.varint();
    ids.push(last);
  }
  return ids;
}

export const snapshotCodec: SnapshotCodec<Snapshot> = {
  encode(s, previous) {
    const w = new ByteWriter(512);
    const { self } = s;
    w.u8(self.alive ? 1 : 0)
      .varint(self.mass)
      .varint(self.best)
      .varint(self.kills);
    w.varint(self.rank)
      .varint(self.of)
      .varint(self.by)
      .i16(self.x * Q)
      .i16(self.y * Q);

    const before = new Map(previous?.worms.map((x) => [x.id, x]) ?? []);
    w.varint(s.worms.length);
    let lastId = 0;
    for (const worm of s.worms) {
      w.varint(worm.id - lastId);
      lastId = worm.id;
      const p = before.get(worm.id);
      const boost = worm.boosting ? BOOSTING : 0;
      if (p && sameTrail(rebuiltTrail(p, worm.x, worm.y, worm.mass), worm.trail)) {
        w.u8(CONTINUING | boost)
          .svarint((worm.x - p.x) * Q)
          .svarint((worm.y - p.y) * Q);
        w.u8(worm.heading).svarint(worm.mass - p.mass);
        continue;
      }
      w.u8(boost)
        .i16(worm.x * Q)
        .i16(worm.y * Q)
        .u8(worm.heading)
        .varint(worm.mass);
      w.varint(worm.trail.length / 2);
      let px = worm.x;
      let py = worm.y;
      for (let i = 0; i < worm.trail.length; i += 2) {
        const x = worm.trail[i] ?? 0;
        const y = worm.trail[i + 1] ?? 0;
        w.svarint((x - px) * Q).svarint((y - py) * Q);
        px = x;
        py = y;
      }
    }

    const had = new Set(previous?.orbs.map((o) => o.id) ?? []);
    const has = new Set(s.orbs.map((o) => o.id));
    writeIds(
      w,
      [...had].filter((id) => !has.has(id)).sort((a, b) => a - b),
    );
    const added = s.orbs.filter((o) => !had.has(o.id));
    writeIds(
      w,
      added.map((o) => o.id),
    );
    for (const orb of added)
      w.i16(orb.x * Q)
        .i16(orb.y * Q)
        .varint(orb.value)
        .u8(orb.hue);

    w.u8(s.board.length);
    for (const b of s.board) w.varint(b.id).varint(b.mass);
    w.varint(s.feed.length);
    for (const f of s.feed) w.varint(f.victim).varint(f.by);

    // Names: new ones, and those the reader still has for worms that are gone.
    const known = new Map(previous?.names.map((n) => [n.id, n]) ?? []);
    const named = new Set(s.names.map((n) => n.id));
    writeIds(
      w,
      [...mentioned(s)].filter((id) => known.has(id) && !named.has(id)).sort((a, b) => a - b),
    );
    const fresh = s.names.filter((n) => !known.has(n.id));
    writeIds(
      w,
      fresh.map((n) => n.id),
    );
    for (const n of fresh)
      w.u8(n.bot ? 1 : 0)
        .u8(n.look)
        .string(n.name);
    return w.finish();
  },

  decode(bytes, previous) {
    const r = new ByteReader(bytes);
    const self = {
      alive: r.u8() === 1,
      mass: r.varint(),
      best: r.varint(),
      kills: r.varint(),
      rank: r.varint(),
      of: r.varint(),
      by: r.varint(),
      x: r.i16() / Q,
      y: r.i16() / Q,
    };

    const before = new Map(previous?.worms.map((x) => [x.id, x]) ?? []);
    const worms: SnapshotWorm[] = [];
    let lastId = 0;
    for (let n = r.varint(); n > 0; n--) {
      const id = (lastId += r.varint());
      const flags = r.u8();
      const boosting = (flags & BOOSTING) !== 0;
      if (flags & CONTINUING) {
        const p = before.get(id);
        if (!p) throw new RangeError(`worm ${String(id)} continues but wasn't in view`);
        const x = p.x + r.svarint() / Q;
        const y = p.y + r.svarint() / Q;
        const heading = r.u8();
        const mass = p.mass + r.svarint();
        worms.push({ id, x, y, heading, mass, boosting, trail: rebuiltTrail(p, x, y, mass) });
        continue;
      }
      const x = r.i16() / Q;
      const y = r.i16() / Q;
      const heading = r.u8();
      const mass = r.varint();
      const trail: number[] = [];
      let px = x;
      let py = y;
      for (let k = r.varint(); k > 0; k--) {
        px += r.svarint() / Q;
        py += r.svarint() / Q;
        trail.push(px, py);
      }
      worms.push({ id, x, y, heading, mass, boosting, trail });
    }

    const gone = new Set(readIds(r));
    const orbs: SnapshotOrb[] = (previous?.orbs ?? []).filter((o) => !gone.has(o.id));
    for (const id of readIds(r))
      orbs.push({ id, x: r.i16() / Q, y: r.i16() / Q, value: r.varint(), hue: r.u8() });
    orbs.sort((a, b) => a.id - b.id);

    const board = Array.from({ length: r.u8() }, () => ({ id: r.varint(), mass: r.varint() }));
    const feed = Array.from({ length: r.varint() }, () => ({ victim: r.varint(), by: r.varint() }));

    const dropped = new Set(readIds(r));
    const known = new Map(previous?.names.map((n) => [n.id, n]) ?? []);
    for (const id of readIds(r)) {
      const bot = r.u8() === 1;
      const look = r.u8();
      known.set(id, { id, name: r.string(), look, bot });
    }
    const names: SnapshotName[] = [...mentioned({ worms, board, feed })]
      .filter((id) => !dropped.has(id))
      .map((id) => known.get(id))
      .filter((n): n is SnapshotName => n !== undefined)
      .sort((a, b) => a.id - b.id);
    if (!r.done) throw new RangeError("bytes left over after a snapshot");
    return { self, worms, orbs, board, feed, names };
  },
};

/** Two bytes: the heading, and boost. */
export const inputCodec: InputCodec<Input> = {
  encode: (input) => new Uint8Array([angleToByte(input.heading), input.boost ? 1 : 0]),
  decode(bytes) {
    if (bytes.length !== 2 || (bytes[1] ?? 0) > 1) return null;
    return { heading: byteToAngle(bytes[0] ?? 0), boost: bytes[1] === 1 };
  },
};
