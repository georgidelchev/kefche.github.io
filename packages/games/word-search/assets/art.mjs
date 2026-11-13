// Word Search sticker art (`pnpm art:generate`): a grid of letter squares
// with a green capsule over a diagonal run and a magnifying glass. Letters
// are drawn as short bars (no text), so it renders the same everywhere.

const CARD = "#f8fafc";
const FOUND = "#15803d";
const GLASS = "#0ea5e9";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const s = 17;
  const x0 = 30;
  const y0 = 14;
  let cells = "";
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const x = x0 + c * s;
      const y = y0 + r * s;
      cells += `<rect x="${String(x + 4)}" y="${String(y + 7)}" width="${String(s - 8)}" height="3" rx="1.5" fill="${INK}" opacity="0.55"/>`;
    }
  }
  const card = `<rect x="${String(x0 - 4)}" y="${String(y0 - 4)}" width="${String(5 * s + 8)}" height="${String(5 * s + 8)}" rx="8" fill="${CARD}" stroke="${INK}" stroke-width="4"/>`;
  const capsule = `<rect x="${String(x0 - 2)}" y="${String(y0 + 2 * s)}" width="${String(5 * s + 4)}" height="${String(s)}" rx="${String(s / 2)}" fill="${FOUND}" opacity="0.85" transform="rotate(45 ${String(x0 + 2.5 * s)} ${String(y0 + 2.5 * s)})"/>`;
  const glass = `<circle cx="128" cy="78" r="16" fill="${WHITE}" fill-opacity="0.4" stroke="${GLASS}" stroke-width="6"/><line x1="139" y1="90" x2="150" y2="104" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`;
  return shadowed(card) + capsule + cells + glass + sparkle(144, 20) + sparkle(14, 104, 6, WHITE);
}
