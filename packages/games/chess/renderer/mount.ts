// Chess entry for the player: a turn session (seats, bots, timers) drives
// the match, and React renders its views.
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import { runTurnGame, type GameContext, type GameInstance } from "@kefche/game-sdk/browser";

import { engine } from "../engine";
import { Game } from "./Game";
import { createSounds } from "./sounds";

export function mount(container: HTMLElement, context: GameContext): GameInstance {
  const root = createRoot(container);
  const sounds = createSounds(context);
  sounds.preload();
  // Takebacks are asked of the other player; against bots, Undo does that job.
  // Rated games have none: the server's replay knows no takebacks.
  const config = { takebacks: context.match?.mode !== "solo-bots" && !context.online?.rated };
  return runTurnGame(context, {
    engine,
    config,
    // Stockfish loads only now, when a bot plays (it's 1.8 MB).
    createBotWorker: () =>
      new Worker(new URL("./bots.worker.ts", import.meta.url), { type: "module" }),
    allowUndo: true,
    render({ seed, session, store }) {
      // A new key (seed) remounts the board for a fresh match.
      root.render(createElement(Game, { key: seed, context, config, store, session, sounds }));
    },
    dispose() {
      root.unmount();
      sounds.dispose();
    },
  });
}
