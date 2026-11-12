// Tap Frenzy sticker art (`pnpm art:generate`): a big round button with
// ripples spreading from it and tap marks, as if tapped again and again. Drawn in a
// 160 × 120 box with the shared kit.

const BUTTON = "#f97316";
const RING = "#fdba74";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const ripples = [46, 38]
    .map(
      (r, i) =>
        `<circle cx="80" cy="62" r="${String(r)}" fill="none" stroke="${RING}" stroke-width="${String(4 - i)}" opacity="${String(0.5 + i * 0.3)}"/>`,
    )
    .join("");
  const button = `<circle cx="80" cy="62" r="28" fill="${BUTTON}" stroke="${INK}" stroke-width="4"/>`;
  const shine = `<ellipse cx="72" cy="52" rx="10" ry="6" fill="${WHITE}" opacity="0.6"/>`;
  // Tap marks: short strokes over the button, like motion lines.
  const count = [
    [70, 66, 66, 76],
    [80, 64, 80, 76],
    [90, 66, 94, 76],
  ]
    .map(
      ([x1, y1, x2, y2]) =>
        `<line x1="${String(x1)}" y1="${String(y1)}" x2="${String(x2)}" y2="${String(y2)}" stroke="${WHITE}" stroke-width="4" stroke-linecap="round"/>`,
    )
    .join("");
  return ripples + shadowed(button) + shine + count + sparkle(140, 22) + sparkle(22, 26, 6, WHITE);
}
