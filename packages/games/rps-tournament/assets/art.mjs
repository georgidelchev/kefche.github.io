// Rock Paper Scissors Tournament sticker art (`pnpm art:generate`): a
// stone, a sheet and a pair of blades round a little bracket. Drawn in a
// 160 × 120 box with the shared kit.

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const bracket = `<path d="M60 30 H76 V60 H92 M60 90 H76 V60" fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`;
  const stone = `<path d="M18 40c-2-9 4-17 13-19 9-2 17 2 19 11s-2 17-12 17H28c-5 0-9-3-10-9z" fill="#9aa3b5" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
  const sheet =
    `<path d="M24 70h22l9 9v30H24z" fill="${WHITE}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="M46 70v9h9" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`;
  const blades =
    `<path d="M106 76 L142 34 M130 76 L108 40" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>` +
    `<circle cx="102" cy="84" r="9" fill="#e69f00" stroke="${INK}" stroke-width="4"/>` +
    `<circle cx="134" cy="84" r="9" fill="#e69f00" stroke="${INK}" stroke-width="4"/>`;
  return (
    shadowed(bracket, 2, 2) +
    shadowed(stone) +
    shadowed(sheet) +
    shadowed(blades) +
    sparkle(140, 104)
  );
}
