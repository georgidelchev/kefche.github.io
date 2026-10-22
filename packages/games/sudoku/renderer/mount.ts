// Sudoku entry for the player: renders the React board into the container.
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import type { GameContext, GameInstance } from "@kefche/game-sdk/browser";

import { Game, type GameHandle } from "./Game";

export function mount(container: HTMLElement, context: GameContext): GameInstance {
  const root = createRoot(container);
  // Read by the board's input handlers and clock; a pause doesn't need a re-render.
  const handle: GameHandle = { paused: false };
  const render = (seed: string) => {
    // A new key (seed) remounts the board, back to the difficulty menu.
    root.render(createElement(Game, { key: seed, context, seed, handle }));
  };
  render(context.seed);
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
      render(seed);
      context.report({ type: "start" });
    },
    destroy() {
      root.unmount();
    },
  };
}
