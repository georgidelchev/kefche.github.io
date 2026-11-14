// Categories sticker art (`pnpm art:generate`): a lined answer sheet with
// six rows, some ticked and one crossed out, a letter tile with an A drawn
// in strokes, and a pencil. Drawn in a 160 × 120 box with the shared kit
// (no text, so the art renders the same everywhere).

const PAPER = "#fef3c7";
const TILE = "#0d9488";
const PENCIL = "#f59e0b";
const TICK = "#16a34a";
const CROSS = "#dc2626";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const sheet = `<rect x="40" y="14" width="78" height="96" rx="8" fill="${PAPER}" stroke="${INK}" stroke-width="3.5"/>`;
  let rows = "";
  for (let i = 0; i < 6; i++) {
    const y = 28 + i * 14;
    const width = [34, 26, 40, 30, 22, 36][i] ?? 30;
    rows += `<path d="M50 ${String(y)} H${String(50 + width)}" stroke="${INK}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>`;
    if (i === 3) {
      rows += `<path d="M98 ${String(y - 4)} L106 ${String(y + 4)} M106 ${String(y - 4)} L98 ${String(y + 4)}" stroke="${CROSS}" stroke-width="3" stroke-linecap="round"/>`;
    } else if (i !== 4) {
      rows += `<path d="M97 ${String(y)} L101 ${String(y + 4)} L108 ${String(y - 4)}" fill="none" stroke="${TICK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  }
  const tile = `<rect x="10" y="40" width="40" height="40" rx="9" fill="${TILE}" stroke="${INK}" stroke-width="3.5"/><path d="M21 71 L30 48 L39 71 M24.5 63 H35.5" fill="none" stroke="${WHITE}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
  const pencil = `<g transform="rotate(35 132 70)"><rect x="126" y="38" width="12" height="52" rx="2" fill="${PENCIL}" stroke="${INK}" stroke-width="3"/><path d="M126 90 L132 104 L138 90 Z" fill="${PAPER}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M130.5 99 L132 104 L133.5 99 Z" fill="${INK}"/></g>`;
  return (
    shadowed(sheet) + rows + shadowed(tile) + pencil + sparkle(146, 22) + sparkle(22, 24, 6, WHITE)
  );
}
