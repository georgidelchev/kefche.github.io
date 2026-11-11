// Gin Rummy sticker art (`pnpm art:generate`): two melds laid down, a run
// of hearts and a set of sevens. Drawn in a 160 × 120 box with the shared
// kit; the suits are the SDK deck's shapes.

const RED = "#c81e1e";
const HEART =
  "M12 21.5C9 19 2 14.5 2 8.6A5.1 5.1 0 0 1 12 6.4A5.1 5.1 0 0 1 22 8.6C22 14.5 15 19 12 21.5Z";
const SPADE =
  "M12 1.5C15 4.5 22 9 22 14.2A4.9 4.9 0 0 1 13.3 17.3L14.8 22.5H9.2L10.7 17.3A4.9 4.9 0 0 1 2 14.2C2 9 9 4.5 12 1.5Z";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const card = (x, y, rank, suit, colour) =>
    `<rect x="${String(x)}" y="${String(y)}" width="34" height="48" rx="5" fill="${WHITE}" stroke="${INK}" stroke-width="3.5"/>` +
    `<text x="${String(x + 8)}" y="${String(y + 15)}" font-family="system-ui, sans-serif" font-weight="800" font-size="12" text-anchor="middle" fill="${colour}">${rank}</text>` +
    `<path d="${suit}" transform="translate(${String(x + 9)} ${String(y + 20)}) scale(0.7)" fill="${colour}"/>`;
  const run =
    card(14, 18, "4", HEART, RED) + card(34, 18, "5", HEART, RED) + card(54, 18, "6", HEART, RED);
  const set =
    card(76, 56, "7", SPADE, INK) + card(96, 56, "7", HEART, RED) + card(116, 56, "7", SPADE, INK);
  return shadowed(run) + shadowed(set) + sparkle(142, 22) + sparkle(24, 96, 6);
}
