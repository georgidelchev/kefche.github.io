// Mafia sticker art (`pnpm art:generate`): a crescent moon over a row of
// houses, one window lit, and a hat with a band in front. Drawn in a
// 160 × 120 box with the shared kit.

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, shadowed, sparkle }) {
  const moon = `<path d="M132 14 a18 18 0 1 0 12 30 a14 14 0 1 1 -12 -30 z" fill="#f0e442" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`;
  const house = (x, h, lit) =>
    `<path d="M${String(x)} 100 V${String(100 - h)} l18 -16 l18 16 V100 z" fill="#3b4cc0" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>` +
    `<rect x="${String(x + 12)}" y="${String(100 - h + 8)}" width="12" height="12" rx="2" fill="${lit ? "#f0e442" : "#1e2a6e"}" stroke="${INK}" stroke-width="2.5"/>`;
  const houses = house(14, 40, false) + house(52, 52, true) + house(90, 36, false);
  const hat =
    `<path d="M40 104 h80 a6 6 0 0 1 0 12 h-80 a6 6 0 0 1 0 -12 z" fill="#2b2f3a" stroke="${INK}" stroke-width="3.5"/>` +
    `<path d="M54 106 l6 -28 h40 l6 28 z" fill="#2b2f3a" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>` +
    `<path d="M57 96 h46" stroke="#d55e00" stroke-width="6"/>`;
  return (
    shadowed(moon) + shadowed(houses) + shadowed(hat) + sparkle(96, 22, 5) + sparkle(20, 30, 4)
  );
}
