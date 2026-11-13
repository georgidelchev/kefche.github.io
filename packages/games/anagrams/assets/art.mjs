// Anagrams sticker art (`pnpm art:generate`): seven letter tiles in an arc,
// with curved arrows swapping two of them. Letters are drawn as simple
// strokes (no text), so the art renders the same everywhere.

const TILE = "#fef3c7";
const ARROW = "#7c3aed";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  let tiles = "";
  for (let i = 0; i < 7; i++) {
    const x = 14 + i * 19;
    const y = 58 + Math.abs(3 - i) * 5;
    tiles += `<rect x="${String(x)}" y="${String(y)}" width="17" height="17" rx="3" fill="${TILE}" stroke="${INK}" stroke-width="2.5"/>`;
    tiles += `<path d="M${String(x + 5)} ${String(y + 12)} l3.5 -8 l3.5 8 M${String(x + 6.5)} ${String(y + 9)} h4" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" opacity="${i % 2 ? "0.9" : "0.5"}"/>`;
  }
  const arrows = `<path d="M52 50 C62 28 98 28 108 50" fill="none" stroke="${ARROW}" stroke-width="5" stroke-linecap="round"/><path d="M102 46 L108 52 L113 44" fill="none" stroke="${ARROW}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
  return shadowed(tiles) + arrows + sparkle(142, 22) + sparkle(18, 30, 6, WHITE);
}
