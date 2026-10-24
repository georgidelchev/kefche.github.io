// Another player's 2048 board in a race: the tiles in the board's own colors,
// with their numbers once there's room for them.
import { createMiniCanvas, type MiniView } from "@kefche/game-sdk/browser";

import { SIZE, type State } from "../engine";

const TILE: Record<number, [string, string]> = {
  2: ["#eee4da", "#3b2f2a"],
  4: ["#ede0c8", "#3b2f2a"],
  8: ["#f2b179", "#3b2f2a"],
  16: ["#f59563", "#3b2f2a"],
  32: ["#f67c5f", "#ffffff"],
  64: ["#e2502e", "#ffffff"],
  128: ["#edcf72", "#3b2f2a"],
  256: ["#edcc61", "#3b2f2a"],
  512: ["#edc850", "#3b2f2a"],
  1024: ["#4f9de0", "#ffffff"],
  2048: ["#2563c9", "#ffffff"],
};
const BIG: [string, string] = ["#1c1f3a", "#ffffff"];

export function mini(container: HTMLElement): MiniView {
  let state: State | null = null;
  const view = createMiniCanvas(container, (ctx, size, color) => {
    ctx.fillStyle = color("border-strong");
    ctx.fillRect(0, 0, size, size);
    const pad = size * 0.03;
    const cell = (size - pad * 2) / SIZE;
    const inset = cell * 0.06;
    const draw = (row: number, col: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(
        pad + col * cell + inset,
        pad + row * cell + inset,
        cell - inset * 2,
        cell - inset * 2,
        cell * 0.12,
      );
      ctx.fill();
    };
    for (let i = 0; i < SIZE * SIZE; i++) draw(Math.floor(i / SIZE), i % SIZE, color("surface-2"));
    for (const tile of state?.tiles ?? []) {
      const [fill, ink] = TILE[tile.value] ?? BIG;
      draw(tile.row, tile.col, fill);
      if (cell < 22) continue;
      const text = String(tile.value);
      ctx.fillStyle = ink;
      ctx.font = `800 ${String(Math.round(cell * (text.length > 3 ? 0.26 : 0.36)))}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, pad + (tile.col + 0.5) * cell, pad + (tile.row + 0.5) * cell);
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
