// Color Clash sticker art (`pnpm art:generate`): four paint blobs in the
// game's inks, overlapping, with a speech-bubble-like card on top whose
// stripes clash with them. Drawn in a 160 × 120 box with the shared kit
// (no text, so it renders the same everywhere).

const INKS = ["#D55E00", "#56B4E9", "#009E73", "#F0E442"];

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const blobs = [
    [56, 46],
    [104, 46],
    [56, 82],
    [104, 82],
  ]
    .map(
      ([x, y], i) =>
        `<circle cx="${String(x)}" cy="${String(y)}" r="24" fill="${INKS[i]}" stroke="${INK}" stroke-width="4"/>`,
    )
    .join("");
  const card = `<rect x="50" y="50" width="60" height="28" rx="8" fill="#1d2333" stroke="${INK}" stroke-width="4"/>`;
  const stripes = [0, 1, 2]
    .map(
      (i) =>
        `<rect x="${String(58 + i * 16)}" y="58" width="12" height="12" rx="3" fill="${INKS[(i + 1) % 4]}"/>`,
    )
    .join("");
  return shadowed(blobs) + card + stripes + sparkle(144, 18) + sparkle(18, 100, 6, WHITE);
}
