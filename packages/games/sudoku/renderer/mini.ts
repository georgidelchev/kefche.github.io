// Another player's Sudoku in a race: the game's own grid, smaller, showing
// which cells they've filled in but never their digits.
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import type { MiniView } from "@kefche/game-sdk/browser";

import { MiniBoard } from "./Game";

import type { State } from "../engine";

export function mini(container: HTMLElement): MiniView {
  const root = createRoot(container);
  return {
    update(state) {
      root.render(createElement(MiniBoard, { state: state as State }));
    },
    destroy() {
      // Called while the room's own React tree updates.
      queueMicrotask(() => {
        root.unmount();
      });
    },
  };
}
