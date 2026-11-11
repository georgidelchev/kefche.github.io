// Liar's Dice sticker art (`pnpm art:generate`): a cup tipped up, with the
// dice it hid in front of it. Drawn in a 160 × 120 box with the shared kit.

const PIPS = {
  1: [[1, 1]],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  6: [
    [0, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [2, 2],
  ],
};

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const die = (x, y, size, angle, face, fill) =>
    `<g transform="rotate(${String(angle)} ${String(x + size / 2)} ${String(y + size / 2)})">` +
    `<rect x="${String(x)}" y="${String(y)}" width="${String(size)}" height="${String(size)}" rx="${String(size / 5)}" fill="${fill}" stroke="${INK}" stroke-width="3.5"/>` +
    PIPS[face]
      .map(
        ([c, r]) =>
          `<circle cx="${String(x + size * (0.25 + c * 0.25))}" cy="${String(y + size * (0.25 + r * 0.25))}" r="${String(size / 11)}" fill="${INK}"/>`,
      )
      .join("") +
    `</g>`;
  const cup =
    `<g transform="rotate(-24 60 52)"><path d="M30 12 L90 12 L80 86 L40 86 Z" fill="#c2410c" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
    `<rect x="26" y="6" width="68" height="12" rx="5" fill="#ea580c" stroke="${INK}" stroke-width="4"/>` +
    `<path d="M44 30 L76 30" stroke="${INK}" stroke-width="3" stroke-linecap="round" opacity="0.35"/></g>`;
  const dice =
    die(64, 70, 34, -10, 6, WHITE) +
    die(100, 76, 30, 14, 4, "#f0e442") +
    die(118, 44, 26, 28, 1, WHITE);
  return shadowed(cup) + shadowed(dice) + sparkle(30, 98) + sparkle(144, 26, 5);
}
