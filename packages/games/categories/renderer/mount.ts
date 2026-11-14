// Categories entry for the player: the word lists load first (an answer is
// checked against the blocklist, ADR-0050), then a turn session drives the
// match (online, the arena server's table, since sheets and votes are secret
// until all are in) and React renders it. The clocks are watched so a sheet
// is sent before time runs out.
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import { runTurnGame, type GameContext, type GameInstance } from "@kefche/game-sdk/browser";
import { loadLexicons } from "@kefche/lexicons/browser";

import { configFrom, engine } from "../engine";
import { manifest } from "../manifest";
import { watchClocks } from "./clock";
import { Game } from "./Game";
import { createSounds } from "./sounds";

export function mount(container: HTMLElement, context: GameContext): GameInstance {
  const root = createRoot(container);
  const sounds = createSounds(context);
  sounds.preload();
  const config = configFrom(context.match?.config);
  const clock = watchClocks(context);
  return runTurnGame(clock.context, {
    engine,
    config,
    ready: loadLexicons(config.pack, manifest.lexicons),
    createBotWorker: () =>
      new Worker(new URL("./bots.worker.ts", import.meta.url), { type: "module" }),
    render({ seed, session, store }) {
      // A new key (seed) remounts the game for a fresh match.
      root.render(
        createElement(Game, { key: seed, context: clock.context, store, session, sounds, clock }),
      );
    },
    dispose() {
      root.unmount();
      sounds.dispose();
    },
  });
}
