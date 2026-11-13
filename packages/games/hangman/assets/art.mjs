// Hangman sticker art (`pnpm art:generate`): a wooden gallows with a
// stick figure half drawn, and a row of letter tiles beneath, some blank.
// Drawn in a 160 × 120 box with the shared kit (no text: the tiles show
// bars for letters).

const WOOD = "#b45309";
const TILE = "#fef3c7";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const gallows = `<path d="M30 92 H86 M44 92 V14 H92 V26" fill="none" stroke="${WOOD}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 92 H86 M44 92 V14 H92 V26" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>`;
  const man = `<g fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"><circle cx="92" cy="36" r="9" fill="${WHITE}"/><path d="M92 45 V66 M92 52 L82 60 M92 52 L102 60"/></g>`;
  const tiles = [0, 1, 2, 3, 4]
    .map((i) => {
      const x = 46 + i * 20;
      const filled = i === 1 || i === 3;
      return `<rect x="${String(x)}" y="98" width="16" height="16" rx="3" fill="${TILE}" stroke="${INK}" stroke-width="2.5"/>${filled ? `<rect x="${String(x + 4)}" y="104" width="8" height="4" rx="1" fill="${INK}"/>` : ""}`;
    })
    .join("");
  return shadowed(gallows) + man + tiles + sparkle(140, 20) + sparkle(18, 30, 6, WHITE);
}
