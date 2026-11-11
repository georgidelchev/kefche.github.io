// Split or Steal sticker art (`pnpm art:generate`): a gold coin cut in
// two, one half drifting towards a waiting hand. Drawn in a 160 × 120 box
// with the shared kit.

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, shadowed, sparkle }) {
  const GOLD = "#e6b422";
  const left = `<path d="M70 18a42 42 0 0 0 0 84z" fill="${GOLD}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
  const right = `<g transform="translate(14 -6) rotate(10 90 60)"><path d="M84 18a42 42 0 0 1 0 84z" fill="${GOLD}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/></g>`;
  const hand = `<path d="M118 92 h22 l8 6 v14 h-30 l-12 -6 z" fill="#f4c49b" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
  return shadowed(left) + shadowed(right) + shadowed(hand) + sparkle(34, 24) + sparkle(130, 20, 5);
}
