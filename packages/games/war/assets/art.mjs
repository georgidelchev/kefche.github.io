// War sticker art (`pnpm art:generate`): two cards meeting head on, an ace
// of hearts against a king of spades, with a clash between them. Drawn in a
// 160 × 120 box with the shared kit; the suits are the SDK deck's shapes.

const RED = "#c81e1e";
const BURST = "#f2c94c";
const HEART =
  "M12 21.5C9 19 2 14.5 2 8.6A5.1 5.1 0 0 1 12 6.4A5.1 5.1 0 0 1 22 8.6C22 14.5 15 19 12 21.5Z";
const SPADE =
  "M12 1.5C15 4.5 22 9 22 14.2A4.9 4.9 0 0 1 13.3 17.3L14.8 22.5H9.2L10.7 17.3A4.9 4.9 0 0 1 2 14.2C2 9 9 4.5 12 1.5Z";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const card = (x, y, angle, rank, suit, colour) =>
    `<g transform="rotate(${String(angle)} ${String(x + 24)} ${String(y + 34)})">` +
    `<rect x="${String(x)}" y="${String(y)}" width="48" height="68" rx="6" fill="${WHITE}" stroke="${INK}" stroke-width="4"/>` +
    `<text x="${String(x + 10)}" y="${String(y + 20)}" font-family="system-ui, sans-serif" font-weight="800" font-size="15" text-anchor="middle" fill="${colour}">${rank}</text>` +
    `<path d="${suit}" transform="translate(${String(x + 12)} ${String(y + 22)}) scale(1)" fill="${colour}"/>` +
    `</g>`;
  const burst = `<path d="M80 38l5 12 12-6-5 12 13 4-13 5 6 12-12-5-6 12-5-12-12 6 5-12-13-5 13-4-6-12 12 6z" fill="${BURST}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  return (
    shadowed(card(22, 26, -12, "A", HEART, RED)) +
    shadowed(card(90, 26, 12, "K", SPADE, INK)) +
    shadowed(burst, 2, 2) +
    sparkle(24, 20, 6) +
    sparkle(140, 100)
  );
}
