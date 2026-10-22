// Snake entry for the player: renders the menu and board into the container.
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import type { GameContext, GameInstance } from "@kefche/game-sdk/browser";

import { Game, type GameHandle } from "./Game";

export function mount(container: HTMLElement, context: GameContext): GameInstance {
  const root = createRoot(container);
  // Read by the game loop and input handlers; a pause doesn't need a re-render.
  const handle: GameHandle = { paused: false };
  const render = (seed: string, quickStart: boolean) => {
    // A new key (seed) remounts the game. The first game opens the settings
    // menu; New game and Play again start straight away with the same ones.
    root.render(createElement(Game, { key: seed, context, seed, handle, quickStart }));
  };
  render(context.seed, false);
  context.report({ type: "start" });
  return {
    pause() {
      handle.paused = true;
    },
    resume() {
      handle.paused = false;
    },
    restart(seed) {
      handle.paused = false;
      render(seed, true);
      context.report({ type: "start" });
    },
    destroy() {
      root.unmount();
    },
  };
}
