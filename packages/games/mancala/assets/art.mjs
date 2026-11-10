// Mancala sticker art (`pnpm art:generate`): a wooden board with two rows of
// pits and a store at each end, seeds in the pits and a handful mid-sow.
// Drawn in a 160 × 120 box with the shared kit. Seed colours are --player-1
// and --player-2.

const WOOD = "#8a5a2b";
const PIT = "#5e3b19";
const ORANGE = "#e69f00";
const BLUE = "#56b4e9";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, shadowed, sparkle }) {
  const pit = (x, y, seeds, colour) => {
    let dots = "";
    for (let i = 0; i < seeds; i++) {
      const a = (i / seeds) * Math.PI * 2;
      dots += `<circle cx="${(x + Math.cos(a) * 3.4).toFixed(1)}" cy="${(y + Math.sin(a) * 3.4).toFixed(1)}" r="2.2" fill="${colour}" stroke="${INK}" stroke-width="1"/>`;
    }
    return `<circle cx="${String(x)}" cy="${String(y)}" r="7.5" fill="${PIT}" stroke="${INK}" stroke-width="2"/>${dots}`;
  };
  let pits = "";
  for (let i = 0; i < 4; i++) {
    pits += pit(52 + i * 19, 52, 3 + (i % 2), BLUE);
    pits += pit(52 + i * 19, 74, 4 - (i % 2), ORANGE);
  }
  const board =
    `<rect x="18" y="36" width="124" height="54" rx="24" fill="${WOOD}" stroke="${INK}" stroke-width="4"/>` +
    `<rect x="26" y="44" width="14" height="38" rx="7" fill="${PIT}" stroke="${INK}" stroke-width="2"/>` +
    `<rect x="120" y="44" width="14" height="38" rx="7" fill="${PIT}" stroke="${INK}" stroke-width="2"/>` +
    pits;
  const flying =
    `<circle cx="96" cy="24" r="3" fill="${ORANGE}" stroke="${INK}" stroke-width="1.4"/>` +
    `<circle cx="106" cy="18" r="3" fill="${ORANGE}" stroke="${INK}" stroke-width="1.4"/>` +
    `<circle cx="116" cy="22" r="3" fill="${ORANGE}" stroke="${INK}" stroke-width="1.4"/>` +
    `<path d="M86 30q14-18 36-4" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="1 4" stroke-linecap="round"/>`;
  return (
    shadowed(`<g transform="rotate(-4 80 64)">${board}</g>`) +
    shadowed(flying, 2, 2) +
    sparkle(22, 22, 6) +
    sparkle(146, 102)
  );
}
