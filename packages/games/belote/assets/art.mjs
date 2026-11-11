// Belote sticker art (`pnpm art:generate`): a jack and a nine of trumps
// with a belote pair (king and queen) behind them. Drawn in a 160 × 120 box
// with the shared kit; the suit is the SDK deck's club.

const CLUB =
  "M12 2A4.6 4.6 0 0 1 15.6 9.5A4.6 4.6 0 1 1 13.4 17.4L14.8 22.5H9.2L10.6 17.4A4.6 4.6 0 1 1 8.4 9.5A4.6 4.6 0 0 1 12 2Z";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const card = (angle, rank) =>
    `<g transform="rotate(${String(angle)} 80 112)">` +
    `<rect x="56" y="22" width="48" height="68" rx="6" fill="${WHITE}" stroke="${INK}" stroke-width="4"/>` +
    `<text x="66" y="42" font-family="system-ui, sans-serif" font-weight="800" font-size="15" text-anchor="middle" fill="${INK}">${rank}</text>` +
    `<path d="${CLUB}" transform="translate(68 48) scale(1)" fill="${INK}"/>` +
    `</g>`;
  const crown = `<path d="M114 30l6 8 6-10 6 10 6-8v14h-24z" fill="#f2c94c" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  return (
    shadowed(card(-24, "K")) +
    shadowed(card(-8, "Q")) +
    shadowed(card(10, "9")) +
    shadowed(card(26, "J")) +
    shadowed(crown, 2, 2) +
    sparkle(24, 26, 6)
  );
}
