// Trivia sticker art (`pnpm art:generate`): a speech bubble with a
// question mark drawn in strokes, over four answer bars, one ticked. Drawn
// in a 160 × 120 box with the shared kit (no text).

const BUBBLE = "#7c3aed";
const BAR = "#fef3c7";
const RIGHT = "#16a34a";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const bubble = `<path d="M48 10 H112 a12 12 0 0 1 12 12 V44 a12 12 0 0 1 -12 12 H90 L80 66 L72 56 H48 a12 12 0 0 1 -12 -12 V22 a12 12 0 0 1 12 -12 Z" fill="${BUBBLE}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`;
  const mark = `<path d="M72 26 a8 8 0 1 1 11 7.5 c-2.5 1 -3 2.5 -3 5" fill="none" stroke="${WHITE}" stroke-width="4.5" stroke-linecap="round"/><circle cx="80" cy="47" r="2.8" fill="${WHITE}"/>`;
  let bars = "";
  const spots = [
    [22, 74],
    [84, 74],
    [22, 96],
    [84, 96],
  ];
  spots.forEach(([x, y], i) => {
    const right = i === 1;
    bars += `<rect x="${String(x)}" y="${String(y)}" width="54" height="16" rx="5" fill="${right ? RIGHT : BAR}" stroke="${INK}" stroke-width="3"/>`;
    if (right) {
      bars += `<path d="M${String(x + 20)} ${String(y + 8)} l5 5 l9 -9" fill="none" stroke="${WHITE}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else {
      bars += `<path d="M${String(x + 10)} ${String(y + 8)} H${String(x + 40)}" stroke="${INK}" stroke-width="3" stroke-linecap="round" opacity="0.5"/>`;
    }
  });
  return shadowed(bubble) + mark + bars + sparkle(140, 22) + sparkle(22, 30, 6, WHITE);
}
