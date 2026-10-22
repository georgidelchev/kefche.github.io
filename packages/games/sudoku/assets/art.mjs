// Sudoku sticker art (`pnpm art:generate`): a tilted grid card with a pencil.
// Drawn in a 160 × 120 box with the shared kit.

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, digits }) {
  let grid = `<g transform="rotate(6 76 60)"><rect x="34" y="18" width="84" height="84" rx="10" fill="${WHITE}" stroke="${INK}" stroke-width="4"/>`;
  for (let i = 1; i < 3; i++) {
    grid += `<line x1="${34 + i * 28}" y1="20" x2="${34 + i * 28}" y2="100" stroke="${INK}" stroke-width="2.5"/>`;
    grid += `<line x1="36" y1="${18 + i * 28}" x2="116" y2="${18 + i * 28}" stroke="${INK}" stroke-width="2.5"/>`;
  }
  grid +=
    digits(7, 76, 60, 19, "#2563eb", 3.6) +
    digits(3, 48, 32, 12, INK, 2.8) +
    digits(9, 104, 88, 12, INK, 2.8) +
    `</g>`;
  const pencil =
    `<g transform="rotate(-38 118 70)">` +
    `<rect x="96" y="63" width="50" height="14" rx="2" fill="#fde047" stroke="${INK}" stroke-width="3"/>` +
    `<rect x="140" y="63" width="10" height="14" rx="3" fill="#f9a8d4" stroke="${INK}" stroke-width="3"/>` +
    `<path d="M96 63L84 70L96 77Z" fill="#f2dcb3" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    `</g>`;
  return shadowed(grid) + shadowed(pencil, 3, 3);
}
