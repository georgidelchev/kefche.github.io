// Another player's 2048 board in a race: the game's own board, smaller, with
// their moves played back one slide at a time.
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import { createPlayback, type MiniView } from "@kefche/game-sdk/browser";

import { MiniBoard } from "./Game";

import type { State } from "../engine";

/** About the tiles' slide (110 ms), so each move shows. */
const MOVE_MS = 130;

export function mini(container: HTMLElement): MiniView {
  const root = createRoot(container);
  const motion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let drawn: State | null = null;
  const playback = createPlayback<State>({
    duration: (state, previous) => (state.moves === previous.moves || !motion ? 0 : MOVE_MS),
    draw: (state) => {
      if (state === drawn) return;
      drawn = state;
      root.render(createElement(MiniBoard, { state, motion }));
    },
  });
  return {
    update(state, steps) {
      playback.push(state as State, steps as readonly State[] | undefined);
    },
    destroy() {
      playback.stop();
      // Called while the room's own React tree updates.
      queueMicrotask(() => {
        root.unmount();
      });
    },
  };
}
