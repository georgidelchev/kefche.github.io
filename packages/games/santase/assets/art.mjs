// Santase sticker art (`pnpm art:generate`): a marriage (king and queen of
// hearts) over the stock, with the trump card turned across it. Drawn in a
// 160 × 120 box with the shared kit; the suit is the SDK deck's heart.

const RED = "#c81e1e";
const HEART =
  "M12 21.5C9 19 2 14.5 2 8.6A5.1 5.1 0 0 1 12 6.4A5.1 5.1 0 0 1 22 8.6C22 14.5 15 19 12 21.5Z";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const card = (x, y, angle, rank) =>
    `<g transform="rotate(${String(angle)} ${String(x + 24)} ${String(y + 34)})">` +
    `<rect x="${String(x)}" y="${String(y)}" width="48" height="68" rx="6" fill="${WHITE}" stroke="${INK}" stroke-width="4"/>` +
    `<text x="${String(x + 10)}" y="${String(y + 20)}" font-family="system-ui, sans-serif" font-weight="800" font-size="15" text-anchor="middle" fill="${RED}">${rank}</text>` +
    `<path d="${HEART}" transform="translate(${String(x + 12)} ${String(y + 26)})" fill="${RED}"/>` +
    `</g>`;
  const back = `<rect x="18" y="38" width="48" height="68" rx="6" fill="#1e3a8a" stroke="${INK}" stroke-width="4"/>`;
  return (
    shadowed(back) +
    shadowed(card(30, 50, 90, "9")) +
    shadowed(card(68, 20, -10, "K")) +
    shadowed(card(98, 26, 12, "Q")) +
    sparkle(140, 20) +
    sparkle(26, 24, 6)
  );
}
