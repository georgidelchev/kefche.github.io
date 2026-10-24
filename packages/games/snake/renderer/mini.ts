// Another player's Snake board in a race: the game's own board, smaller,
// played back step by step at their snake's speed.
import {
  createCanvasStage,
  createPlayback,
  onThemeChange,
  type MiniView,
} from "@kefche/game-sdk/browser";

import { COLS, ROWS, stepMs, type State } from "../engine";
import { drawBoard, readColors } from "./draw";
import { CSS } from "./Game";

export function mini(container: HTMLElement): MiniView {
  // Decorative: the standings next to it say how the player is doing.
  const root = document.createElement("div");
  root.className = "gsnk-mini";
  root.setAttribute("aria-hidden", "true");
  const style = document.createElement("style");
  style.textContent = CSS;
  const board = document.createElement("div");
  board.className = "gsnk-board";
  const holder = document.createElement("div");
  holder.className = "gsnk-canvas";
  const canvas = document.createElement("canvas");
  holder.append(canvas);
  board.append(holder);
  root.append(style, board);
  container.append(root);

  const ctx = canvas.getContext("2d");
  let colors = readColors(board);
  let shown: { state: State; previous: State; alpha: number } | null = null;
  const paint = () => {
    if (ctx && shown) drawBoard(ctx, shown.state, shown.previous, shown.alpha, colors);
  };
  const stage = createCanvasStage(canvas, COLS, ROWS, paint);
  const playback = createPlayback<State>({
    // A step takes as long as it did for them; a turn, or the step that ends
    // the game (the snake stays put), shows at once.
    duration: (state, previous) =>
      state.ticks === previous.ticks || state.over ? 0 : stepMs(previous),
    draw: (state, previous, alpha) => {
      shown = { state, previous, alpha };
      paint();
    },
  });
  const offTheme = onThemeChange(() => {
    colors = readColors(board);
    paint();
  });

  return {
    update(state, steps) {
      const next = state as State;
      board.toggleAttribute("data-walls", next.config.walls);
      playback.push(next, steps as readonly State[] | undefined);
    },
    destroy() {
      playback.stop();
      stage.dispose();
      offTheme();
      root.remove();
    },
  };
}
