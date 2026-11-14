// The games whose online play runs on a table (Phase 12, ADR-0047): turn
// games with hidden information (manifest `hiddenInformation`), by id. Each
// is its own engine (with `view`), bots and manifest; the table is the same
// code for all of them.
import { bots as assocBots } from "@kefche/game-associations/bots";
import { engine as assocEngine } from "@kefche/game-associations/engine";
import { manifest as assocManifest } from "@kefche/game-associations/manifest";
import { bots as bgBots } from "@kefche/game-backgammon/bots";
import { engine as bgEngine } from "@kefche/game-backgammon/engine";
import { manifest as bgManifest } from "@kefche/game-backgammon/manifest";
import { bots as beloteBots } from "@kefche/game-belote/bots";
import { engine as beloteEngine } from "@kefche/game-belote/engine";
import { manifest as beloteManifest } from "@kefche/game-belote/manifest";
import { bots as categoriesBots } from "@kefche/game-categories/bots";
import { engine as categoriesEngine } from "@kefche/game-categories/engine";
import { manifest as categoriesManifest } from "@kefche/game-categories/manifest";
import { bots as conquestBots } from "@kefche/game-conquest/bots";
import { engine as conquestEngine } from "@kefche/game-conquest/engine";
import { manifest as conquestManifest } from "@kefche/game-conquest/manifest";
import { bots as crazyBots } from "@kefche/game-crazy-colors/bots";
import { engine as crazyEngine } from "@kefche/game-crazy-colors/engine";
import { manifest as crazyManifest } from "@kefche/game-crazy-colors/manifest";
import { bots as durakBots } from "@kefche/game-durak/bots";
import { engine as durakEngine } from "@kefche/game-durak/engine";
import { manifest as durakManifest } from "@kefche/game-durak/manifest";
import { bots as ginBots } from "@kefche/game-gin-rummy/bots";
import { engine as ginEngine } from "@kefche/game-gin-rummy/engine";
import { manifest as ginManifest } from "@kefche/game-gin-rummy/manifest";
import { bots as hangmanBots } from "@kefche/game-hangman/bots";
import { engine as hangmanEngine } from "@kefche/game-hangman/engine";
import { manifest as hangmanManifest } from "@kefche/game-hangman/manifest";
import { bots as heartsBots } from "@kefche/game-hearts/bots";
import { engine as heartsEngine } from "@kefche/game-hearts/engine";
import { manifest as heartsManifest } from "@kefche/game-hearts/manifest";
import { bots as liarsBots } from "@kefche/game-liars-dice/bots";
import { engine as liarsEngine } from "@kefche/game-liars-dice/engine";
import { manifest as liarsManifest } from "@kefche/game-liars-dice/manifest";
import { bots as lunBots } from "@kefche/game-lowest-unique/bots";
import { engine as lunEngine } from "@kefche/game-lowest-unique/engine";
import { manifest as lunManifest } from "@kefche/game-lowest-unique/manifest";
import { bots as ludoBots } from "@kefche/game-ludo/bots";
import { engine as ludoEngine } from "@kefche/game-ludo/engine";
import { manifest as ludoManifest } from "@kefche/game-ludo/manifest";
import { bots as mafiaBots } from "@kefche/game-mafia/bots";
import { engine as mafiaEngine } from "@kefche/game-mafia/engine";
import { manifest as mafiaManifest } from "@kefche/game-mafia/manifest";
import { bots as pairsBots } from "@kefche/game-memory-pairs/bots";
import { engine as pairsEngine } from "@kefche/game-memory-pairs/engine";
import { manifest as pairsManifest } from "@kefche/game-memory-pairs/manifest";
import { bots as penBots } from "@kefche/game-penalty-shootout/bots";
import { engine as penEngine } from "@kefche/game-penalty-shootout/engine";
import { manifest as penManifest } from "@kefche/game-penalty-shootout/manifest";
import { bots as rpsBots } from "@kefche/game-rps-tournament/bots";
import { engine as rpsEngine } from "@kefche/game-rps-tournament/engine";
import { manifest as rpsManifest } from "@kefche/game-rps-tournament/manifest";
import { bots as santaseBots } from "@kefche/game-santase/bots";
import { engine as santaseEngine } from "@kefche/game-santase/engine";
import { manifest as santaseManifest } from "@kefche/game-santase/manifest";
import type { GameBots, GameManifest, TurnEngine } from "@kefche/game-sdk";
import { bots as seaBots } from "@kefche/game-sea-battle/bots";
import { engine as seaEngine } from "@kefche/game-sea-battle/engine";
import { manifest as seaManifest } from "@kefche/game-sea-battle/manifest";
import { bots as spadesBots } from "@kefche/game-spades/bots";
import { engine as spadesEngine } from "@kefche/game-spades/engine";
import { manifest as spadesManifest } from "@kefche/game-spades/manifest";
import { bots as sosBots } from "@kefche/game-split-or-steal/bots";
import { engine as sosEngine } from "@kefche/game-split-or-steal/engine";
import { manifest as sosManifest } from "@kefche/game-split-or-steal/manifest";
import { bots as warBots } from "@kefche/game-war/bots";
import { engine as warEngine } from "@kefche/game-war/engine";
import { manifest as warManifest } from "@kefche/game-war/manifest";
import { bots as spyBots } from "@kefche/game-whos-the-spy/bots";
import { engine as spyEngine } from "@kefche/game-whos-the-spy/engine";
import { manifest as spyManifest } from "@kefche/game-whos-the-spy/manifest";

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
  "liars-dice": tableGame(liarsManifest, liarsEngine, liarsBots),
  "sea-battle": tableGame(seaManifest, seaEngine, seaBots),
  conquest: tableGame(conquestManifest, conquestEngine, conquestBots),
  "memory-pairs": tableGame(pairsManifest, pairsEngine, pairsBots),
  "rps-tournament": tableGame(rpsManifest, rpsEngine, rpsBots),
  "lowest-unique": tableGame(lunManifest, lunEngine, lunBots),
  "split-or-steal": tableGame(sosManifest, sosEngine, sosBots),
  "penalty-shootout": tableGame(penManifest, penEngine, penBots),
  "whos-the-spy": tableGame(spyManifest, spyEngine, spyBots),
  associations: tableGame(assocManifest, assocEngine, assocBots),
  mafia: tableGame(mafiaManifest, mafiaEngine, mafiaBots),
  hangman: tableGame(hangmanManifest, hangmanEngine, hangmanBots),
  war: tableGame(warManifest, warEngine, warBots),
  categories: tableGame(categoriesManifest, categoriesEngine, categoriesBots),
};
