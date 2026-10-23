// Four in a Row sticker art (`pnpm art:generate`): a small upright board with
// a winning diagonal of orange discs and a blue disc falling in. Drawn in a
// 160 × 120 box with the shared kit. Disc colours are --player-1 and --player-2.

const ORANGE = "#e69f00";
const BLUE = "#56b4e9";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const x = (col) => 44 + col * 18;
  const y = (row) => 98 - row * 18;
  const disc = (col, row, fill) =>
    `<circle cx="${String(x(col))}" cy="${String(y(row))}" r="7.2" fill="${fill}" stroke="${INK}" stroke-width="2.6"/>`;
  let holes = "";
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 4; row++) {
      holes += `<circle cx="${String(x(col))}" cy="${String(y(row))}" r="7.2" fill="#e6eaf3"/>`;
    }
  }
  const discs = [
    [0, 0, ORANGE],
    [1, 0, BLUE],
    [1, 1, ORANGE],
    [2, 0, BLUE],
    [2, 1, BLUE],
    [2, 2, ORANGE],
    [3, 0, ORANGE],
    [3, 1, BLUE],
    [3, 2, BLUE],
    [3, 3, ORANGE],
    [4, 0, BLUE],
  ]
    .map(([col, row, fill]) => disc(col, row, fill))
    .join("");
  const board =
    `<rect x="30" y="30" width="100" height="82" rx="10" fill="${WHITE}" stroke="${INK}" stroke-width="4"/>` +
    holes +
    discs;
  const falling =
    `<circle cx="${String(x(4))}" cy="14" r="8" fill="${BLUE}" stroke="${INK}" stroke-width="3"/>` +
    `<path d="M${String(x(4) - 12)} 4v8M${String(x(4) + 12)} 2v8" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
  return shadowed(board) + shadowed(falling, 3, 3) + sparkle(22, 20, 6) + sparkle(146, 40);
}
