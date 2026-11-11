// Lowest Unique Number sticker art (`pnpm art:generate`): three cards held
// up with numbers, two showing the same and one, the lowest of its kind,
// shining. Drawn in a 160 × 120 box with the shared kit.

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle, digits }) {
  const card = (x, y, angle, fill, value) =>
    `<g transform="rotate(${String(angle)} ${String(x + 20)} ${String(y + 26)})">` +
    `<rect x="${String(x)}" y="${String(y)}" width="40" height="52" rx="7" fill="${fill}" stroke="${INK}" stroke-width="4"/>` +
    digits(value, x + 20, y + 26, 26, INK, 3.5) +
    `</g>`;
  const cards =
    card(14, 40, -10, WHITE, 2) + card(60, 22, 0, "#f0e442", 1) + card(106, 40, 10, WHITE, 2);
  return shadowed(cards) + sparkle(104, 18) + sparkle(54, 18, 5);
}
