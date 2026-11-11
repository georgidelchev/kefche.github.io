// Memory Pairs entry for the player: a turn session drives the match (online, the
// arena server's table, since the face-down cards are secret), and React renders it.
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import { runTurnGame, type GameContext, type GameInstance } from "@kefche/game-sdk/browser";

import { configFrom, engine } from "../engine";
import { Game } from "./Game";
import { createSounds } from "./sounds";

export function mount(container: HTMLElement, context: GameContext): GameInstance {
  const root = createRoot(container);
  const sounds = createSounds(context);
  sounds.preload();
  return runTurnGame(context, {
    engine,
    config: configFrom(context.match?.config),
    createBotWorker: () =>
      new Worker(new URL("./bots.worker.ts", import.meta.url), { type: "module" }),
    render({ seed, session, store }) {
      // A new key (seed) remounts the table for a fresh game.
      root.render(createElement(Game, { key: seed, context, store, session, sounds }));
    },
    dispose() {
      root.unmount();
      sounds.dispose();
    },
  });
}
