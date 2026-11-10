// Tower of Hanoi sticker art (`pnpm art:generate`): three pegs on a wooden
// base, a stack of coloured discs on the left and one disc lifted over the
// middle peg. Drawn in a 160 × 120 box with the shared kit.

const WOOD = "#a3763f";
const POLE = "#7a5428";
const HUES = ["#e69f00", "#56b4e9", "#009e73", "#cc79a7"];

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, shadowed, sparkle }) {
  const base = `<rect x="16" y="96" width="128" height="12" rx="5" fill="${WOOD}" stroke="${INK}" stroke-width="3"/>`;
  const poles = [40, 80, 120]
    .map(
      (x) =>
        `<rect x="${String(x - 3)}" y="34" width="6" height="64" rx="3" fill="${POLE}" stroke="${INK}" stroke-width="2"/>`,
    )
    .join("");
  const disc = (cx, y, w, i) =>
    `<rect x="${String(cx - w / 2)}" y="${String(y)}" width="${String(w)}" height="10" rx="5" fill="${HUES[i]}" stroke="${INK}" stroke-width="2.2"/>`;
  const stack = disc(40, 86, 40, 0) + disc(40, 75, 32, 1) + disc(40, 64, 24, 2);
  const lifted =
    disc(80, 18, 16, 3) +
    `<path d="M74 34l6 6 6-6" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="1 3"/>`;
  return (
    shadowed(base + poles + stack) + shadowed(lifted, 2, 2) + sparkle(140, 22) + sparkle(18, 30, 6)
  );
}
