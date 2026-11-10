// Lights Off sticker art (`pnpm art:generate`): a dark panel of square
// lights, a plus-shaped group glowing and a finger pressing the middle one.
// Drawn in a 160 × 120 box with the shared kit.

const PANEL = "#1d2333";
const OFF = "#39415a";
const ON = "#ffd84a";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const s = 18;
  const x0 = 42;
  const y0 = 16;
  const lit = new Set(["1,2", "2,1", "2,2", "2,3", "3,2", "0,0", "3,0"]);
  let cells = "";
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const on = lit.has(`${String(r)},${String(c)}`);
      cells += `<rect x="${String(x0 + c * (s + 4))}" y="${String(y0 + r * (s + 4))}" width="${String(s)}" height="${String(s)}" rx="4" fill="${on ? ON : OFF}" stroke="${INK}" stroke-width="2"/>`;
    }
  }
  const panel = `<rect x="${String(x0 - 8)}" y="${String(y0 - 8)}" width="${String(4 * (s + 4) + 12)}" height="${String(4 * (s + 4) + 12)}" rx="10" fill="${PANEL}" stroke="${INK}" stroke-width="4"/>`;
  const glow = `<circle cx="${String(x0 + 2 * (s + 4) + s / 2)}" cy="${String(y0 + 2 * (s + 4) + s / 2)}" r="28" fill="${ON}" opacity="0.18"/>`;
  return shadowed(panel + cells) + glow + sparkle(146, 22) + sparkle(20, 100, 6, WHITE);
}
