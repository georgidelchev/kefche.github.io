// Memory Match sticker art (`pnpm art:generate`): a 3 × 2 spread of cards,
// four face down and a matching pair of stars face up. Drawn in a 160 × 120
// box with the shared kit.

const BACK = "#2b4fb3";
const STRIPE = "#3560d0";
const FACE = "#fffdf7";
const STAR = "#c77700";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, shadowed, sparkle }) {
  const w = 30;
  const h = 40;
  const gap = 8;
  const x0 = 80 - (3 * w + 2 * gap) / 2;
  const y0 = 60 - (2 * h + gap) / 2;
  const star = (cx, cy, r) => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
    }
    return `<polygon points="${pts.join(" ")}" fill="${STAR}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`;
  };
  let cards = "";
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const x = x0 + c * (w + gap);
      const y = y0 + r * (h + gap);
      const up = (r === 0 && c === 0) || (r === 1 && c === 2);
      const card = `<rect x="${String(x)}" y="${String(y)}" width="${String(w)}" height="${String(h)}" rx="5" fill="${up ? FACE : BACK}" stroke="${INK}" stroke-width="3"/>`;
      cards += shadowed(card, 3, 3);
      if (up) cards += star(x + w / 2, y + h / 2, 10);
      else {
        cards += `<path d="M${String(x + 7)} ${String(y + 8)}h${String(w - 14)}M${String(x + 7)} ${String(y + h / 2)}h${String(w - 14)}M${String(x + 7)} ${String(y + h - 8)}h${String(w - 14)}" stroke="${STRIPE}" stroke-width="4" stroke-linecap="round"/>`;
      }
    }
  }
  return cards + sparkle(148, 22) + sparkle(14, 100, 6);
}
