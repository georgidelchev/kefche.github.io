// Reversi sticker art (`pnpm art:generate`): a tilted corner of the green
// board with discs, one of them mid-flip. Drawn in a 160 × 120 box with the
// shared kit. Disc colours are --player-1 and --player-2.

const ORANGE = "#e69f00";
const BLUE = "#56b4e9";
const GREEN = "#2f7d4f";
const LINE = "#1d4f32";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, shadowed, sparkle }) {
  const cell = 22;
  const x0 = 36;
  const y0 = 22;
  let grid = "";
  for (let i = 1; i < 4; i++) {
    grid += `<path d="M${String(x0 + i * cell)} ${String(y0)}v${String(cell * 4)}M${String(x0)} ${String(y0 + i * cell)}h${String(cell * 4)}" stroke="${LINE}" stroke-width="2"/>`;
  }
  const disc = (col, row, fill) =>
    `<circle cx="${String(x0 + col * cell + cell / 2)}" cy="${String(y0 + row * cell + cell / 2)}" r="8" fill="${fill}" stroke="${INK}" stroke-width="2.6"/>`;
  const discs = [
    disc(1, 1, BLUE),
    disc(2, 1, ORANGE),
    disc(1, 2, ORANGE),
    disc(2, 2, BLUE),
    disc(3, 2, ORANGE),
    disc(0, 3, ORANGE),
  ].join("");
  // The flipping disc: an ellipse, half one colour, half the other.
  const fx = x0 + 2 * cell + cell / 2;
  const fy = y0 + 3 * cell + cell / 2;
  const flip =
    `<ellipse cx="${String(fx)}" cy="${String(fy)}" rx="3.5" ry="8.5" fill="${BLUE}" stroke="${INK}" stroke-width="2.6"/>` +
    `<path d="M${String(fx - 9)} ${String(fy - 4)}q-4 4 0 8M${String(fx + 9)} ${String(fy - 4)}q4 4 0 8" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
  const board =
    `<g transform="rotate(-6 80 66)"><rect x="${String(x0)}" y="${String(y0)}" width="${String(cell * 4)}" height="${String(cell * 4)}" rx="8" fill="${GREEN}" stroke="${INK}" stroke-width="4"/>` +
    grid +
    discs +
    flip +
    `</g>`;
  return shadowed(board) + sparkle(140, 26) + sparkle(22, 92, 6);
}
