// Snake sticker art (`pnpm art:generate`): a googly-eyed snake curling toward
// an orange. Drawn in a 160 × 120 box with the shared kit.

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed }) {
  const body = "M24 92C24 60 64 60 64 78C64 96 104 96 104 64C104 44 92 38 98 30";
  const outline = (width) =>
    `<path d="${body}" fill="none" stroke="${INK}" stroke-width="${width}" stroke-linecap="round"/>`;
  const snake =
    outline(22) +
    `<path d="${body}" fill="none" stroke="#84cc16" stroke-width="14" stroke-linecap="round"/>`;
  const head =
    `<circle cx="102" cy="30" r="15" fill="#84cc16" stroke="${INK}" stroke-width="4"/>` +
    `<circle cx="96" cy="24" r="6" fill="${WHITE}" stroke="${INK}" stroke-width="2.5"/>` +
    `<circle cx="109" cy="24" r="6" fill="${WHITE}" stroke="${INK}" stroke-width="2.5"/>` +
    `<circle cx="98" cy="25" r="2.6" fill="${INK}"/><circle cx="111" cy="25" r="2.6" fill="${INK}"/>` +
    `<path d="M116 36L126 38M126 38L131 34M126 38L130 43" fill="none" stroke="#e11d48" stroke-width="2.5" stroke-linecap="round"/>`;
  const orange =
    `<circle cx="138" cy="84" r="13" fill="#ff6b1a" stroke="${INK}" stroke-width="4"/>` +
    `<path d="M138 71C140 64 146 62 150 64C148 69 143 71 138 71Z" fill="#4d7c0f" stroke="${INK}" stroke-width="2.5"/>`;
  // The body's shadow is a wider ink stroke, offset like the others.
  return (
    `<g transform="translate(4 4)">${outline(22)}</g>` +
    snake +
    shadowed(head, 3, 3) +
    shadowed(orange, 3, 3)
  );
}
