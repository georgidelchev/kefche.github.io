// Math Sprint sticker art (`pnpm art:generate`): a stopwatch beside a card
// of arithmetic signs (plus, minus, times, divide), drawn as shapes.
// Drawn in a 160 × 120 box with the shared kit (no text).

const CARD = "#dbeafe";
const WATCH = "#f97316";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const card = `<rect x="20" y="24" width="72" height="72" rx="12" fill="${CARD}" stroke="${INK}" stroke-width="4"/>`;
  const plus = `<path d="M38 40 v16 M30 48 h16" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  const minus = `<path d="M66 48 h16" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  const times = `<path d="M32 70 l12 12 M44 70 l-12 12" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  const divide = `<path d="M66 76 h16" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><circle cx="74" cy="68" r="3" fill="${INK}"/><circle cx="74" cy="84" r="3" fill="${INK}"/>`;
  const watch = `<circle cx="118" cy="66" r="26" fill="${WHITE}" stroke="${INK}" stroke-width="4"/><rect x="112" y="30" width="12" height="8" rx="2" fill="${WATCH}" stroke="${INK}" stroke-width="3"/><path d="M118 66 V48 M118 66 l12 8" stroke="${WATCH}" stroke-width="5" stroke-linecap="round"/>`;
  return (
    shadowed(card + watch) +
    plus +
    minus +
    times +
    divide +
    sparkle(146, 18) +
    sparkle(14, 100, 6, WHITE)
  );
}
