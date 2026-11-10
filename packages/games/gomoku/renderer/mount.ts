// Gomoku entry for the player: a turn session (seats, bots, timers) drives
// the match with the rule the setup or the room chose, and the shared line
// board renders it.
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import { runTurnGame, type GameContext, type GameInstance } from "@kefche/game-sdk/browser";

import { engine } from "../engine";
import { LineGame } from "./LineGame";
import { createSounds } from "./sounds";

export function mount(container: HTMLElement, context: GameContext): GameInstance {
  const root = createRoot(container);
  const sounds = createSounds(context);
  sounds.preload();
  const config = context.match?.config;
  return runTurnGame(context, {
    engine,
    config,
    createBotWorker: () =>
      new Worker(new URL("./bots.worker.ts", import.meta.url), { type: "module" }),
    allowUndo: true,
    render({ seed, session, store }) {
      const initial = engine.initialState(config, 2, seed);
      // A new key (seed) remounts the board for a fresh match.
      root.render(
        createElement(LineGame, {
          key: seed,
          context,
          store,
          session,
          sounds,
          initial,
          look: "stones",
        }),
      );
    },
    dispose() {
      root.unmount();
      sounds.dispose();
    },
  });
}
