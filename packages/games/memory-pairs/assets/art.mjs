// Memory Pairs sticker art (`pnpm art:generate`): two cards turned up as a
// pair of hearts, a card face down between them, and two players' counters
// keeping score. Drawn in a 160 × 120 box with the shared kit.

const BACK = "#2b4fb3";
const STRIPE = "#3560d0";
const FACE = "#fffdf7";
const HEART = "#c2185b";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const card = (x, y, angle, face) => {
    const body = face
      ? `<rect x="${String(x)}" y="${String(y)}" width="38" height="52" rx="6" fill="${FACE}" stroke="${INK}" stroke-width="3.5"/>` +
        `<path transform="translate(${String(x + 7)} ${String(y + 14)}) scale(1)" d="M12 21s-8.5-5.4-8.5-11.2A4.6 4.6 0 0 1 12 7.1a4.6 4.6 0 0 1 8.5 2.7C20.5 15.6 12 21 12 21z" fill="${HEART}"/>`
      : `<rect x="${String(x)}" y="${String(y)}" width="38" height="52" rx="6" fill="${BACK}" stroke="${INK}" stroke-width="3.5"/>` +
        `<path d="M${String(x + 8)} ${String(y + 8)} L${String(x + 30)} ${String(y + 44)} M${String(x + 30)} ${String(y + 8)} L${String(x + 8)} ${String(y + 44)}" stroke="${STRIPE}" stroke-width="4"/>`;
    return `<g transform="rotate(${String(angle)} ${String(x + 19)} ${String(y + 26)})">${body}</g>`;
  };
  const cards = card(16, 30, -12, true) + card(61, 22, 0, false) + card(106, 30, 12, true);
  const counters =
    `<circle cx="52" cy="100" r="9" fill="#e69f00" stroke="${INK}" stroke-width="3"/>` +
    `<circle cx="108" cy="100" r="9" fill="#56b4e9" stroke="${INK}" stroke-width="3"/>` +
    `<path d="M66 100 H94" stroke="${INK}" stroke-width="3" stroke-dasharray="3 4" stroke-linecap="round"/>`;
  return shadowed(cards) + shadowed(counters, 2, 2) + sparkle(80, 12, 6, WHITE);
}
