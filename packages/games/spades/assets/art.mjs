// Spades sticker art (`pnpm art:generate`): the ace of spades over a fan of
// spades, with a bid marker. Drawn in a 160 × 120 box with the shared kit.

const SPADE =
  "M12 1.5C15 4.5 22 9 22 14.2A4.9 4.9 0 0 1 13.3 17.3L14.8 22.5H9.2L10.7 17.3A4.9 4.9 0 0 1 2 14.2C2 9 9 4.5 12 1.5Z";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const card = (angle, rank) =>
    `<g transform="rotate(${String(angle)} 80 112)">` +
    `<rect x="56" y="22" width="48" height="68" rx="6" fill="${WHITE}" stroke="${INK}" stroke-width="4"/>` +
    `<text x="66" y="42" font-family="system-ui, sans-serif" font-weight="800" font-size="15" text-anchor="middle" fill="${INK}">${rank}</text>` +
    `<path d="${SPADE}" transform="translate(68 48) scale(1)" fill="${INK}"/>` +
    `</g>`;
  const ace =
    `<rect x="56" y="22" width="48" height="68" rx="6" fill="${WHITE}" stroke="${INK}" stroke-width="4"/>` +
    `<path d="${SPADE}" transform="translate(62 36) scale(1.5)" fill="${INK}"/>`;
  const chip =
    `<circle cx="124" cy="84" r="16" fill="#e69f00" stroke="${INK}" stroke-width="4"/>` +
    `<text x="124" y="90" font-family="system-ui, sans-serif" font-weight="800" font-size="16" text-anchor="middle" fill="${INK}">4</text>`;
  return (
    shadowed(card(-22, "K")) +
    shadowed(card(22, "Q")) +
    shadowed(ace) +
    shadowed(chip, 2, 2) +
    sparkle(26, 24, 6) +
    sparkle(138, 22)
  );
}
