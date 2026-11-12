// Number Hunt sticker art (`pnpm art:generate`): a 3 × 3 grid of tiles,
// some dimmed as found, and a magnifying glass over one. Drawn in a
// 160 × 120 box with the shared kit (dots stand for numbers: no text).

const TILE = "#e0f2fe";
const FOUND = "#94a3b8";
const GLASS = "#0ea5e9";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const s = 26;
  const x0 = 34;
  const y0 = 18;
  const found = new Set([0, 4, 7]);
  let tiles = "";
  for (let i = 0; i < 9; i++) {
    const x = x0 + (i % 3) * (s + 5);
    const y = y0 + Math.floor(i / 3) * (s + 5);
    const dots = (i % 4) + 1;
    let marks = "";
    for (let d = 0; d < dots; d++)
      marks += `<circle cx="${String(x + 7 + (d % 2) * 12)}" cy="${String(y + 8 + Math.floor(d / 2) * 10)}" r="3" fill="${INK}"/>`;
    tiles += `<rect x="${String(x)}" y="${String(y)}" width="${String(s)}" height="${String(s)}" rx="5" fill="${found.has(i) ? FOUND : TILE}" stroke="${INK}" stroke-width="3"/>${marks}`;
  }
  const glass = `<circle cx="112" cy="62" r="18" fill="${WHITE}" fill-opacity="0.35" stroke="${GLASS}" stroke-width="6"/><line x1="125" y1="75" x2="140" y2="92" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>`;
  return shadowed(tiles) + glass + sparkle(146, 22) + sparkle(18, 100, 6, WHITE);
}
