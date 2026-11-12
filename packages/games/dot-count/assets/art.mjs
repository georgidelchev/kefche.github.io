// Dot Count sticker art (`pnpm art:generate`): a light card scattered with
// dark dots, and a speech bubble with a question mark drawn in strokes.
// Drawn in a 160 × 120 box with the shared kit.

const CARD = "#f8fafc";
const DOT = "#1d2333";
const BUBBLE = "#fde047";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const card = `<rect x="22" y="22" width="84" height="80" rx="12" fill="${CARD}" stroke="${INK}" stroke-width="4"/>`;
  const dots = [
    [38, 40],
    [60, 34],
    [86, 44],
    [44, 62],
    [70, 58],
    [92, 72],
    [36, 86],
    [62, 84],
    [84, 92],
  ]
    .map(([x, y]) => `<circle cx="${String(x)}" cy="${String(y)}" r="6" fill="${DOT}"/>`)
    .join("");
  const bubble = `<path d="M108 14 h36 a8 8 0 0 1 8 8 v24 a8 8 0 0 1 -8 8 h-22 l-10 10 v-10 h-4 a8 8 0 0 1 -8 -8 v-24 a8 8 0 0 1 8 -8 z" fill="${BUBBLE}" stroke="${INK}" stroke-width="4"/>`;
  const mark = `<path d="M120 28 q6 -8 12 0 q4 6 -6 10 v4" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="126" cy="48" r="2.5" fill="${INK}"/>`;
  return shadowed(card) + dots + bubble + mark + sparkle(18, 108, 6, WHITE);
}
