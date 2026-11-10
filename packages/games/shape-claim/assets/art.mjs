// Shape Claim sticker art (`pnpm art:generate`): a corner of the grid with
// four players' pieces meeting at their corners, and a piece being dropped
// in. Drawn in a 160 × 120 box with the shared kit. Colours are --player-1
// to 4.

const COLOURS = ["#e69f00", "#56b4e9", "#009e73", "#cc79a7"];
const CELL = "#ffffff";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, shadowed, sparkle }) {
  const s = 11;
  const x0 = 36;
  const y0 = 16;
  const n = 8;
  const owned = {
    0: [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    1: [
      [3, 3],
      [3, 4],
      [4, 4],
      [4, 5],
    ],
    2: [
      [5, 2],
      [6, 2],
      [6, 3],
      [7, 3],
    ],
    3: [
      [1, 5],
      [1, 6],
      [2, 6],
      [0, 6],
    ],
  };
  const colourAt = new Map();
  for (const [k, cells] of Object.entries(owned))
    for (const [r, c] of cells) colourAt.set(`${String(r)},${String(c)}`, COLOURS[Number(k)]);
  let cells = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const fill = colourAt.get(`${String(r)},${String(c)}`) ?? CELL;
      cells += `<rect x="${String(x0 + c * s)}" y="${String(y0 + r * s)}" width="${String(s - 1.4)}" height="${String(s - 1.4)}" rx="2" fill="${fill}" stroke="${INK}" stroke-width="1.2"/>`;
    }
  }
  const board =
    `<rect x="${String(x0 - 5)}" y="${String(y0 - 5)}" width="${String(n * s + 9)}" height="${String(n * s + 9)}" rx="7" fill="#c9cfdc" stroke="${INK}" stroke-width="3.6"/>` +
    cells;
  const drop = [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 1],
  ]
    .map(
      ([r, c]) =>
        `<rect x="${String(124 + c * s)}" y="${String(66 + r * s)}" width="${String(s - 1.4)}" height="${String(s - 1.4)}" rx="2" fill="${COLOURS[1]}" stroke="${INK}" stroke-width="1.6"/>`,
    )
    .join("");
  return (
    shadowed(board) +
    shadowed(`<g transform="rotate(-14 136 76)">${drop}</g>`, 3, 3) +
    sparkle(20, 24, 6) +
    sparkle(146, 22)
  );
}
