// Another player's Snake board in a race: the snake and the food, in the
// board's colors (red once the snake is out).
import { createMiniCanvas, type MiniView } from "@kefche/game-sdk/browser";

import { COLS, colOf, ROWS, rowOf, type State } from "../engine";

export function mini(container: HTMLElement): MiniView {
  let state: State | null = null;
  const view = createMiniCanvas(container, (ctx, size, color) => {
    ctx.fillStyle = color("surface");
    ctx.fillRect(0, 0, size, size);
    const cell = size / COLS;
    const at = (c: number, fill: string, scale = 1) => {
      const inset = (cell * (1 - scale)) / 2;
      ctx.fillStyle = fill;
      ctx.fillRect(
        colOf(c) * cell + inset,
        rowOf(c) * cell + inset,
        cell - inset * 2,
        cell - inset * 2,
      );
    };
    if (state?.config.walls) {
      ctx.strokeStyle = color("text");
      ctx.lineWidth = Math.max(1, cell * 0.25);
      ctx.strokeRect(0, 0, size, size * (ROWS / COLS));
    }
    if (!state) return;
    if (state.food >= 0) at(state.food, color("brand"), 0.8);
    const body = state.over ? color("danger") : color("accent");
    state.snake.forEach((c, i) => {
      at(c, i === 0 && !state?.over ? color("accent-strong") : body, 0.9);
    });
  });
  return {
    update(next) {
      state = next as State;
      view.redraw();
    },
    destroy() {
      view.destroy();
    },
  };
}
