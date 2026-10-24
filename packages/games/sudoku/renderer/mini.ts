// Another player's Sudoku in a race: which cells they've filled, never the
// digits (they would give the answers away). Givens are dark, filled cells
// take the brand color.
import { createMiniCanvas, type MiniView } from "@kefche/game-sdk/browser";

import { CELLS, type State } from "../engine";

export function mini(container: HTMLElement): MiniView {
  let state: State | null = null;
  const view = createMiniCanvas(container, (ctx, size, color) => {
    ctx.fillStyle = color("surface");
    ctx.fillRect(0, 0, size, size);
    const cell = size / 9;
    if (state) {
      for (let c = 0; c < CELLS; c++) {
        const given = state.givens[c] !== 0;
        const filled = (state.values[c] ?? 0) !== 0;
        if (!given && !filled) continue;
        ctx.fillStyle = given ? color("border-strong") : color("brand");
        ctx.fillRect((c % 9) * cell + 1, Math.floor(c / 9) * cell + 1, cell - 2, cell - 2);
      }
    }
    // The 3 × 3 boxes.
    ctx.strokeStyle = color("text");
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 3; i++) {
      const p = Math.min(size - 0.75, Math.max(0.75, i * 3 * cell));
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
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
