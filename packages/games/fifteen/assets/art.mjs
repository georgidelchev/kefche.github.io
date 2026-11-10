// 15 Puzzle sticker art (`pnpm art:generate`): a tilted frame of numbered
// tiles with the gap, one tile sliding into it. Drawn in a 160 × 120 box
// with the shared kit (its hand-drawn digits).

const FRAME = "#3b4a6b";
const TILE = "#f3e2c4";
const HOME = "#ffd58a";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, shadowed, sparkle, digits }) {
  const s = 22;
  const x0 = 38;
  const y0 = 14;
  let tiles = "";
  const order = [1, 2, 3, 4, 5, 6, 7, 8, 0];
  order.forEach((n, i) => {
    if (n === 0) return;
    const x = x0 + (i % 3) * (s + 3) + (n === 8 ? -8 : 0);
    const y = y0 + Math.floor(i / 3) * (s + 3);
    tiles += `<rect x="${String(x)}" y="${String(y)}" width="${String(s)}" height="${String(s)}" rx="4" fill="${n <= 5 ? HOME : TILE}" stroke="${INK}" stroke-width="2.4"/>`;
    tiles += digits(n, x + s / 2, y + s / 2, 11, INK, 2.4);
  });
  const frame = `<rect x="${String(x0 - 6)}" y="${String(y0 - 6)}" width="${String(3 * s + 18)}" height="${String(3 * s + 18)}" rx="8" fill="${FRAME}" stroke="${INK}" stroke-width="4"/>`;
  return (
    shadowed(`<g transform="rotate(-5 80 58)">${frame}${tiles}</g>`) +
    sparkle(144, 24) +
    sparkle(22, 96, 6)
  );
}
