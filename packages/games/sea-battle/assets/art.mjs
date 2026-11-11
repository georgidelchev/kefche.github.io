// Sea Battle sticker art (`pnpm art:generate`): a corner of a grid at sea,
// a ship across it, a splash for a miss and a hit marked with a cross.
// Drawn in a 160 × 120 box with the shared kit.

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const SEA = "#56b4e9";
  let grid = `<rect x="18" y="12" width="104" height="96" rx="8" fill="${SEA}" stroke="${INK}" stroke-width="4"/>`;
  for (let i = 1; i < 6; i++) {
    const x = 18 + i * 17.3;
    const y = 12 + i * 16;
    grid += `<path d="M${x.toFixed(1)} 14V106M20 ${String(y)}H120" stroke="${INK}" stroke-width="1.5" opacity="0.35"/>`;
  }
  const ship =
    `<path d="M38 50 H112 L104 66 H46 Z" fill="#9aa3b5" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
    `<rect x="62" y="38" width="22" height="12" rx="2" fill="${WHITE}" stroke="${INK}" stroke-width="3.5"/>` +
    `<path d="M73 38 V26" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`;
  const miss = `<circle cx="44" cy="92" r="6" fill="${WHITE}" stroke="${INK}" stroke-width="3"/>`;
  const hit =
    `<circle cx="132" cy="84" r="16" fill="#d55e00" stroke="${INK}" stroke-width="4"/>` +
    `<path d="M124 76 L140 92 M140 76 L124 92" stroke="${WHITE}" stroke-width="4.5" stroke-linecap="round"/>`;
  return shadowed(grid) + shadowed(ship) + miss + shadowed(hit) + sparkle(140, 26);
}
