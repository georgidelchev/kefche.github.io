// Worm Rush's engine: the rules (rules.ts), the wire (codec.ts) and the bots
// (bots.ts) as one RealtimeEngine, for the arena server and the solo arena.
import type { RealtimeEngine } from "@kefche/game-sdk";

import { inputCodec, snapshotCodec } from "./codec";
import {
  alive,
  createWorld,
  join,
  leave,
  respawn,
  result,
  snapshot,
  step,
  type Event,
  type Input,
  type Snapshot,
} from "./rules";
import { CAPACITY, SNAPSHOTS_PER_SECOND, TICKS_PER_SECOND, type World } from "./world";

export { bots } from "./bots";
export type { Event, Input, Snapshot, SnapshotName, SnapshotOrb, SnapshotWorm } from "./rules";
export * from "./world";

export const engine: RealtimeEngine<World, Input, Snapshot, Event> = {
  ticksPerSecond: TICKS_PER_SECOND,
  snapshotsPerSecond: SNAPSHOTS_PER_SECOND,
  capacity: CAPACITY,
  createWorld: (_config, seed) => createWorld(seed),
  join,
  leave,
  respawn,
  alive,
  step,
  snapshot,
  result,
  snapshotCodec,
  inputCodec,
};
