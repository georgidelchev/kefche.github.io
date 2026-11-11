// The games whose online play runs on a table (Phase 12, ADR-0047): turn
// games with hidden information (manifest `hiddenInformation`), by id. Each
// is its own engine (with `view`), bots and manifest; the table is the same
// code for all of them.
import type { GameBots, GameManifest, TurnEngine } from "@kefche/game-sdk";
import { bots as warBots } from "@kefche/game-war/bots";
import { engine as warEngine } from "@kefche/game-war/engine";
import { manifest as warManifest } from "@kefche/game-war/manifest";

export interface TableGame {
  manifest: GameManifest;
  engine: TurnEngine<unknown, unknown, unknown>;
  bots: GameBots<unknown, unknown>;
}

// The engine's types are its own; the table only passes its states and actions along.
export const tableGame = <State, Action, Config>(
  manifest: GameManifest,
  engine: TurnEngine<State, Action, Config>,
  bots: GameBots<State, Action>,
): TableGame => ({
  manifest,
  engine,
  bots,
});

export const TABLE_GAMES: Readonly<Record<string, TableGame>> = {
  war: tableGame(warManifest, warEngine, warBots),
};
