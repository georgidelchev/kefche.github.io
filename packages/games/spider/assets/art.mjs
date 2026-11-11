// Spider sticker art (`pnpm art:generate`): a spider hanging from a thread
// over a run of spades. Drawn in a 160 × 120 box with the shared kit.

const SPADE =
  "M12 1.5C15 4.5 22 9 22 14.2A4.9 4.9 0 0 1 13.3 17.3L14.8 22.5H9.2L10.7 17.3A4.9 4.9 0 0 1 2 14.2C2 9 9 4.5 12 1.5Z";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const card = (x, y, rank) =>
    `<rect x="${String(x)}" y="${String(y)}" width="38" height="54" rx="5" fill="${WHITE}" stroke="${INK}" stroke-width="3.5"/>` +
    `<text x="${String(x + 6)}" y="${String(y + 17)}" font-family="system-ui, sans-serif" font-weight="800" font-size="15" fill="${INK}">${rank}</text>` +
    `<path d="${SPADE}" transform="translate(${String(x + 20)} ${String(y + 4)}) scale(0.65)" fill="${INK}"/>`;
  const run = card(20, 30, "K") + card(20, 50, "Q") + card(20, 70, "J");
  const legs = [-1, 1]
    .flatMap((side) =>
      [0, 1, 2, 3].map(
        (i) =>
          `<path d="M110 ${String(64 + i * 4)}q${String(side * 14)} ${String(-8 + i * 4)} ${String(side * 22)} ${String(4 + i * 4)}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
      ),
    )
    .join("");
  const spider =
    `<path d="M110 8V56" stroke="${INK}" stroke-width="2" stroke-dasharray="2 3"/>` +
    legs +
    `<ellipse cx="110" cy="70" rx="12" ry="14" fill="#2b2f3a" stroke="${INK}" stroke-width="3"/>` +
    `<circle cx="110" cy="54" r="7" fill="#2b2f3a" stroke="${INK}" stroke-width="3"/>` +
    `<circle cx="107" cy="53" r="1.6" fill="${WHITE}"/><circle cx="113" cy="53" r="1.6" fill="${WHITE}"/>`;
  return shadowed(run) + shadowed(spider) + sparkle(144, 100) + sparkle(76, 18, 6);
}
