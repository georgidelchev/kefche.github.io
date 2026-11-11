// Durak sticker art (`pnpm art:generate`): an attack beaten by a higher
// card laid across it, and the trump card turned under the deck. Drawn in a
// 160 × 120 box with the shared kit; the suits are the SDK deck's shapes.

const RED = "#c81e1e";
const DIAMOND = "M12 1.5L20.5 12L12 22.5L3.5 12Z";
const SPADE =
  "M12 1.5C15 4.5 22 9 22 14.2A4.9 4.9 0 0 1 13.3 17.3L14.8 22.5H9.2L10.7 17.3A4.9 4.9 0 0 1 2 14.2C2 9 9 4.5 12 1.5Z";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const card = (x, y, angle, rank, suit, colour) =>
    `<g transform="rotate(${String(angle)} ${String(x + 22)} ${String(y + 31)})">` +
    `<rect x="${String(x)}" y="${String(y)}" width="44" height="62" rx="6" fill="${WHITE}" stroke="${INK}" stroke-width="4"/>` +
    `<text x="${String(x + 10)}" y="${String(y + 18)}" font-family="system-ui, sans-serif" font-weight="800" font-size="14" text-anchor="middle" fill="${colour}">${rank}</text>` +
    `<path d="${suit}" transform="translate(${String(x + 10)} ${String(y + 24)})" fill="${colour}"/>` +
    `</g>`;
  const deck = `<rect x="104" y="32" width="40" height="58" rx="6" fill="#1e3a8a" stroke="${INK}" stroke-width="4"/>`;
  return (
    shadowed(card(96, 46, 90, "6", SPADE, INK)) +
    shadowed(deck) +
    shadowed(card(16, 22, -8, "9", DIAMOND, RED)) +
    shadowed(card(38, 38, 14, "K", DIAMOND, RED)) +
    sparkle(26, 104, 6) +
    sparkle(146, 18)
  );
}
