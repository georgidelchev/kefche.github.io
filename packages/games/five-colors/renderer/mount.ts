// Five Colors entry for the player: a turn session (seats, bots, timers)
// drives the match, and Gomoku's line board renders it, each seat in its own
// colour and shape.
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import { LineGame } from "@kefche/game-gomoku/board";
import { createSounds } from "@kefche/game-gomoku/sounds";
import { runTurnGame, type GameContext, type GameInstance } from "@kefche/game-sdk/browser";

import { engine } from "../engine";

export function mount(container: HTMLElement, context: GameContext): GameInstance {
  const root = createRoot(container);
  const sounds = createSounds(context);
  sounds.preload();
  const seats = context.match?.seats.length ?? 3;
  return runTurnGame(context, {
    engine,
    config: undefined,
    createBotWorker: () =>
      new Worker(new URL("./bots.worker.ts", import.meta.url), { type: "module" }),
    allowUndo: true,
    render({ seed, session, store }) {
      const initial = engine.initialState(undefined, seats, seed);
      // A new key (seed) remounts the board for a fresh match.
      root.render(
        createElement(LineGame, {
          key: seed,
          context,
          store,
          session,
          sounds,
          initial,
          look: "seats",
        }),
      );
    },
    dispose() {
      root.unmount();
      sounds.dispose();
    },
  });
}
