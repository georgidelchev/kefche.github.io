// The games whose online play runs on a table (Phase 12, ADR-0047): turn
// games with hidden information (manifest `hiddenInformation`), by id. Each
// is its own engine (with `view`), bots and manifest; the table is the same
// code for all of them.
import { bots as bgBots } from "@kefche/game-backgammon/bots";
import { engine as bgEngine } from "@kefche/game-backgammon/engine";
import { manifest as bgManifest } from "@kefche/game-backgammon/manifest";
import { bots as beloteBots } from "@kefche/game-belote/bots";
import { engine as beloteEngine } from "@kefche/game-belote/engine";
import { manifest as beloteManifest } from "@kefche/game-belote/manifest";
import { bots as crazyBots } from "@kefche/game-crazy-colors/bots";
import { engine as crazyEngine } from "@kefche/game-crazy-colors/engine";
import { manifest as crazyManifest } from "@kefche/game-crazy-colors/manifest";
import { bots as durakBots } from "@kefche/game-durak/bots";
import { engine as durakEngine } from "@kefche/game-durak/engine";
import { manifest as durakManifest } from "@kefche/game-durak/manifest";
import { bots as ginBots } from "@kefche/game-gin-rummy/bots";
import { engine as ginEngine } from "@kefche/game-gin-rummy/engine";
import { manifest as ginManifest } from "@kefche/game-gin-rummy/manifest";
import { bots as heartsBots } from "@kefche/game-hearts/bots";
import { engine as heartsEngine } from "@kefche/game-hearts/engine";
import { manifest as heartsManifest } from "@kefche/game-hearts/manifest";
import { bots as ludoBots } from "@kefche/game-ludo/bots";
import { engine as ludoEngine } from "@kefche/game-ludo/engine";
import { manifest as ludoManifest } from "@kefche/game-ludo/manifest";
import { bots as santaseBots } from "@kefche/game-santase/bots";
import { engine as santaseEngine } from "@kefche/game-santase/engine";
import { manifest as santaseManifest } from "@kefche/game-santase/manifest";
import type { GameBots, GameManifest, TurnEngine } from "@kefche/game-sdk";
import { bots as spadesBots } from "@kefche/game-spades/bots";
import { engine as spadesEngine } from "@kefche/game-spades/engine";
import { manifest as spadesManifest } from "@kefche/game-spades/manifest";
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
  "crazy-colors": tableGame(crazyManifest, crazyEngine, crazyBots),
  hearts: tableGame(heartsManifest, heartsEngine, heartsBots),
  spades: tableGame(spadesManifest, spadesEngine, spadesBots),
  belote: tableGame(beloteManifest, beloteEngine, beloteBots),
  santase: tableGame(santaseManifest, santaseEngine, santaseBots),
  "gin-rummy": tableGame(ginManifest, ginEngine, ginBots),
  durak: tableGame(durakManifest, durakEngine, durakBots),
  backgammon: tableGame(bgManifest, bgEngine, bgBots),
  ludo: tableGame(ludoManifest, ludoEngine, ludoBots),
  war: tableGame(warManifest, warEngine, warBots),
};
