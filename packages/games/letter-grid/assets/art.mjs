// Letter Grid sticker art (`pnpm art:generate`): a 4 × 4 grid of rounded
// letter squares with a path snaking through five of them. Letters are
// drawn as bars (no text), so it renders the same everywhere.

const SQUARE = "#e0e7ff";
const PATH = "#7c3aed";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const s = 22;
  const x0 = 36;
  const y0 = 12;
  const lit = [0, 5, 6, 11, 15];
  let cells = "";
  for (let i = 0; i < 16; i++) {
    const x = x0 + (i % 4) * (s + 4);
    const y = y0 + Math.floor(i / 4) * (s + 4);
    cells += `<rect x="${String(x)}" y="${String(y)}" width="${String(s)}" height="${String(s)}" rx="6" fill="${lit.includes(i) ? PATH : SQUARE}" stroke="${INK}" stroke-width="2.5"/>`;
    cells += `<rect x="${String(x + 7)}" y="${String(y + 9)}" width="8" height="4" rx="2" fill="${lit.includes(i) ? WHITE : INK}" opacity="0.8"/>`;
  }
  const centre = (i) => [x0 + (i % 4) * (s + 4) + s / 2, y0 + Math.floor(i / 4) * (s + 4) + s / 2];
  const line = lit.map((i, k) => `${k === 0 ? "M" : "L"}${centre(i).join(" ")}`).join(" ");
  const pathEl = `<path d="${line}" fill="none" stroke="${WHITE}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`;
  return shadowed(cells) + pathEl + sparkle(144, 22) + sparkle(18, 100, 6, WHITE);
}
