// Dots and Boxes sticker art (`pnpm art:generate`): a 3 × 2 grid of dots on
// a card, two boxes claimed in orange and blue, and a pencil drawing the next
// line. Drawn in a 160 × 120 box with the shared kit. Box colours are
// --player-1 and --player-2.

const ORANGE = "#e69f00";
const BLUE = "#56b4e9";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const x = (c) => 42 + c * 30;
  const y = (r) => 34 + r * 30;
  const box = (c, r, fill) =>
    `<rect x="${String(x(c))}" y="${String(y(r))}" width="30" height="30" fill="${fill}"/>`;
  const line = (c1, r1, c2, r2) =>
    `<path d="M${String(x(c1))} ${String(y(r1))}L${String(x(c2))} ${String(y(r2))}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  let dots = "";
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      dots += `<circle cx="${String(x(c))}" cy="${String(y(r))}" r="4.2" fill="${INK}"/>`;
    }
  }
  const card =
    `<rect x="28" y="20" width="118" height="88" rx="12" fill="${WHITE}" stroke="${INK}" stroke-width="4"/>` +
    box(0, 0, ORANGE) +
    box(1, 1, BLUE) +
    line(0, 0, 1, 0) +
    line(0, 1, 1, 1) +
    line(0, 0, 0, 1) +
    line(1, 0, 1, 1) +
    line(1, 2, 2, 2) +
    line(2, 1, 2, 2) +
    line(1, 1, 2, 1) +
    line(2, 0, 3, 0) +
    `<path d="M${String(x(3))} ${String(y(0))}L${String(x(3))} ${String(y(0) + 18)}" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 7"/>` +
    dots;
  // A pencil finishing the dashed line.
  const pencil =
    `<g transform="rotate(32 ${String(x(3) + 10)} ${String(y(1) - 4)})">` +
    `<rect x="${String(x(3) + 4)}" y="${String(y(1) - 34)}" width="12" height="36" rx="2" fill="#f6c443" stroke="${INK}" stroke-width="3"/>` +
    `<path d="M${String(x(3) + 4)} ${String(y(1) + 2)}l6 11 6-11z" fill="#f3dcb2" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    `</g>`;
  return shadowed(card) + shadowed(pencil, 3, 3) + sparkle(18, 28, 6) + sparkle(146, 104);
}
