// Reaction Flash sticker art (`pnpm art:generate`): a round pad flashing
// green, with a lightning bolt and a finger about to press it. Drawn in a
// 160 × 120 box with the shared kit.

const GO = "#22c55e";
const GO_INK = "#052e16";
const DARK = "#1d2333";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const pad = `<rect x="30" y="18" width="100" height="84" rx="20" fill="${DARK}" stroke="${INK}" stroke-width="4"/>`;
  const flash = `<circle cx="80" cy="60" r="30" fill="${GO}" stroke="${INK}" stroke-width="4"/>`;
  const bolt = `<path d="M86 36 L68 63 L80 63 L74 86 L94 56 L82 56 Z" fill="${WHITE}" stroke="${GO_INK}" stroke-width="3" stroke-linejoin="round"/>`;
  const rays = [0, 1, 2, 3, 4, 5, 6, 7]
    .map((i) => {
      const a = (i * Math.PI) / 4;
      const x1 = 80 + Math.cos(a) * 36;
      const y1 = 60 + Math.sin(a) * 36;
      const x2 = 80 + Math.cos(a) * 44;
      const y2 = 60 + Math.sin(a) * 44;
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${GO}" stroke-width="4" stroke-linecap="round"/>`;
    })
    .join("");
  return shadowed(pad + flash + bolt) + rays + sparkle(144, 20) + sparkle(16, 98, 6, WHITE);
}
