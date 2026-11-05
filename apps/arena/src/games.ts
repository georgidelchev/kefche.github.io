// The games the arena server runs, by id (their manifests' ids). Each is the
// game's own engine and bots, with how its arenas are filled and how its
// events tell that a life ended.
import type { ArenaBots, ArenaHostOptions, RealtimeEngine } from "@kefche/game-sdk";
import {
  arenaHost as wormHost,
  bots as wormBots,
  engine as wormEngine,
  LOOKS as wormLooks,
  type Event as WormEvent,
} from "@kefche/game-worm-rush/engine";
import { manifest as wormManifest } from "@kefche/game-worm-rush/manifest";

/** A participant's life ended; `by` is who did it (null: the arena itself, like an edge). */
export interface LifeEnd {
  victim: number;
  by: number | null;
}

export interface ArenaGame {
  /** The rules' version, stored with results. */
  version: number;
  engine: RealtimeEngine<unknown, unknown, unknown, unknown>;
  bots: ArenaBots<unknown, unknown>;
  host: Omit<ArenaHostOptions<undefined>, "seed" | "config">;
  /** Looks a player may pick (0 to looks − 1). */
  looks: number;
  /** The lives a tick's events ended. */
  lifeEnds(events: readonly unknown[]): LifeEnd[];
}

// The engine's types are its own; the server only moves bytes between it and the sockets.
const erase = <World, Input, Snapshot, Event>(
  engine: RealtimeEngine<World, Input, Snapshot, Event>,
  bots: ArenaBots<World, Input>,
) => ({
  engine: engine as unknown as RealtimeEngine<unknown, unknown, unknown, unknown>,
  bots: bots as unknown as ArenaBots<unknown, unknown>,
});

export const GAMES: Readonly<Record<string, ArenaGame>> = {
  "worm-rush": {
    version: wormManifest.version,
    ...erase(wormEngine, wormBots),
    host: wormHost,
    looks: wormLooks,
    // Worm Rush's only events are knockouts.
    lifeEnds: (events) =>
      (events as readonly WormEvent[]).map(({ victim, by }) => ({ victim, by })),
  },
};
