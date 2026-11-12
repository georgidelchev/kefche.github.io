// Black Keys sticker art (`pnpm art:generate`): a tilted board of white
// tiles with a staircase of black ones, a finger mark on the lowest.
// Drawn in a 160 × 120 box with the shared kit.

const WHITE_TILE = "#f8fafc";
const BLACK_TILE = "#0f172a";
const LINE = "#94a3b8";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const w = 22;
  const h = 24;
  const x0 = 36;
  const y0 = 12;
  const black = [2, 0, 3, 1];
  let tiles = "";
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const on = black[r] === c;
      tiles += `<rect x="${String(x0 + c * w)}" y="${String(y0 + r * h)}" width="${String(w)}" height="${String(h)}" fill="${on ? BLACK_TILE : WHITE_TILE}" stroke="${LINE}" stroke-width="1"/>`;
    }
  }
  const frame = `<rect x="${String(x0)}" y="${String(y0)}" width="${String(4 * w)}" height="${String(4 * h)}" rx="6" fill="none" stroke="${INK}" stroke-width="4"/>`;
  const tap = `<circle cx="${String(x0 + 1 * w + w / 2)}" cy="${String(y0 + 3 * h + h / 2)}" r="7" fill="none" stroke="${WHITE}" stroke-width="3"/>`;
  return (
    shadowed(`<g transform="rotate(-6 80 60)">${tiles}${frame}${tap}</g>`) +
    sparkle(142, 22) +
    sparkle(18, 98, 6, WHITE)
  );
}
