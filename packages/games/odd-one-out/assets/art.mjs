// Odd One Out sticker art (`pnpm art:generate`): a 3 × 3 grid of rings with
// their gaps facing up, one facing the other way and ringed in yellow.
// Drawn in a 160 × 120 box with the shared kit.

const CARD = "#e2e8f0";
const HIGHLIGHT = "#facc15";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const s = 30;
  const x0 = 36;
  const y0 = 12;
  let cells = "";
  for (let i = 0; i < 9; i++) {
    const x = x0 + (i % 3) * (s + 4);
    const y = y0 + Math.floor(i / 3) * (s + 4);
    const cx = x + s / 2;
    const cy = y + s / 2;
    const odd = i === 5;
    const angle = odd ? 135 : 0;
    cells += `<rect x="${String(x)}" y="${String(y)}" width="${String(s)}" height="${String(s)}" rx="6" fill="${odd ? HIGHLIGHT : CARD}" stroke="${INK}" stroke-width="3"/>`;
    cells += `<g transform="rotate(${String(angle)} ${String(cx)} ${String(cy)})"><path d="M ${String(cx + 3)} ${String(cy - 9.5)} A 10 10 0 1 1 ${String(cx - 3)} ${String(cy - 9.5)}" fill="none" stroke="${INK}" stroke-width="4"/></g>`;
  }
  return shadowed(cells) + sparkle(144, 22) + sparkle(18, 100, 6, WHITE);
}
