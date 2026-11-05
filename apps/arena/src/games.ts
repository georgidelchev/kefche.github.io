// The games the arena server runs, by id (their manifests' ids). Each is the
// game's own engine and bots, with how its arenas are filled.
import type { ArenaBots, ArenaHostOptions, RealtimeEngine } from "@kefche/game-sdk";
import {
  arenaHost as wormHost,
  bots as wormBots,
  engine as wormEngine,
  LOOKS as wormLooks,
} from "@kefche/game-worm-rush/engine";

export interface ArenaGame {
  engine: RealtimeEngine<unknown, unknown, unknown, unknown>;
  bots: ArenaBots<unknown, unknown>;
  host: Omit<ArenaHostOptions<undefined>, "seed" | "config">;
  /** Looks a player may pick (0 to looks − 1). */
  looks: number;
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
  "worm-rush": { ...erase(wormEngine, wormBots), host: wormHost, looks: wormLooks },
};
