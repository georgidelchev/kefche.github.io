// Associations sticker art (`pnpm art:generate`): three speech bubbles,
// two of them saying the same thing, joined by a spark. Drawn in a 160 × 120
// box with the shared kit.

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const bubble = (x, y, w, fill, tail) =>
    `<path d="M${String(x)} ${String(y)} h${String(w)} a10 10 0 0 1 10 10 v20 a10 10 0 0 1 -10 10 h-${String(w - 26)} l-10 ${String(tail)} v-${String(tail)} h-6 a10 10 0 0 1 -10 -10 v-20 a10 10 0 0 1 10 -10 z" fill="${fill}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
  const lines = (x, y) =>
    `<path d="M${String(x)} ${String(y)} h30 M${String(x)} ${String(y + 10)} h20" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  const a = bubble(14, 14, 56, "#f0e442", 12) + lines(26, 28);
  const b = bubble(88, 30, 56, "#f0e442", 12) + lines(100, 44);
  const c =
    bubble(30, 70, 50, WHITE, 10) +
    `<path d="M42 86 h26" stroke="${INK}" stroke-width="4" stroke-linecap="round" opacity="0.5"/>`;
  const spark = `<path d="M80 34 l4 -10 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 z" fill="#e69f00" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
  return shadowed(c) + shadowed(a) + shadowed(b) + spark + sparkle(140, 96, 6);
}
