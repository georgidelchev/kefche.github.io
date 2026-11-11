// Hearts sticker art (`pnpm art:generate`): a fan of hearts with the queen
// of spades on top, the card to avoid. Drawn in a 160 × 120 box with the
// shared kit; the suits are the SDK deck's shapes.

const RED = "#c81e1e";
const HEART =
  "M12 21.5C9 19 2 14.5 2 8.6A5.1 5.1 0 0 1 12 6.4A5.1 5.1 0 0 1 22 8.6C22 14.5 15 19 12 21.5Z";
const SPADE =
  "M12 1.5C15 4.5 22 9 22 14.2A4.9 4.9 0 0 1 13.3 17.3L14.8 22.5H9.2L10.7 17.3A4.9 4.9 0 0 1 2 14.2C2 9 9 4.5 12 1.5Z";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const card = (angle, rank, suit, colour) =>
    `<g transform="rotate(${String(angle)} 80 112)">` +
    `<rect x="56" y="22" width="48" height="68" rx="6" fill="${WHITE}" stroke="${INK}" stroke-width="4"/>` +
    `<text x="66" y="42" font-family="system-ui, sans-serif" font-weight="800" font-size="15" text-anchor="middle" fill="${colour}">${rank}</text>` +
    `<path d="${suit}" transform="translate(68 48) scale(1)" fill="${colour}"/>` +
    `</g>`;
  return (
    shadowed(card(-26, "A", HEART, RED)) +
    shadowed(card(-9, "K", HEART, RED)) +
    shadowed(card(9, "10", HEART, RED)) +
    shadowed(card(26, "Q", SPADE, INK)) +
    sparkle(24, 24, 6) +
    sparkle(138, 20)
  );
}
