// 2048 sticker art (`pnpm art:generate`): a tilted 2048 tile beside a small
// 2, with sparkles. Drawn in a 160 × 120 box with the shared kit.

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, shadowed, sparkle, digits }) {
  const small =
    `<rect x="20" y="58" width="34" height="34" rx="7" fill="#eee4da" stroke="${INK}" stroke-width="3.5"/>` +
    digits(2, 37, 75, 16, "#3b2f2a", 3.4);
  const tile =
    `<g transform="rotate(-9 94 58)"><rect x="56" y="22" width="78" height="72" rx="12" fill="#edc850" stroke="${INK}" stroke-width="4"/>` +
    digits(2048, 95, 58, 21, INK, 3.6) +
    `</g>`;
  return shadowed(small, 3, 3) + shadowed(tile) + sparkle(141, 22) + sparkle(26, 30, 6);
}
