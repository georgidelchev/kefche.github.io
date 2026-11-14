// Word of the Day sticker art (`pnpm art:generate`): a tear-off calendar
// page whose day is a row of five letter tiles, coloured like marked
// guesses (in place, elsewhere, not in the word), with two rings on top.
// No letters, so the art renders the same everywhere.

const PAGE = "#f8fafc";
const BAND = "#ef4444";
const GOOD = "#16a34a";
const NEAR = "#eab308";
const MISS = "#64748b";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const page = `<rect x="24" y="22" width="112" height="86" rx="10" fill="${PAGE}" stroke="${INK}" stroke-width="4"/>`;
  const band = `<path d="M24 32 a10 10 0 0 1 10 -10 h92 a10 10 0 0 1 10 10 v12 h-112 z" fill="${BAND}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
  const rings = [52, 108]
    .map(
      (x) =>
        `<rect x="${String(x - 4)}" y="12" width="8" height="20" rx="4" fill="${WHITE}" stroke="${INK}" stroke-width="3"/>`,
    )
    .join("");
  const colours = [GOOD, NEAR, MISS, GOOD, GOOD];
  const tiles = colours
    .map(
      (fill, i) =>
        `<rect x="${String(32 + i * 20)}" y="58" width="16" height="16" rx="3" fill="${fill}" stroke="${INK}" stroke-width="2.5"/>`,
    )
    .join("");
  // Two blank rows below, still to guess.
  const blanks = [80, 94]
    .map((y) =>
      [0, 1, 2, 3, 4]
        .map(
          (i) =>
            `<rect x="${String(32 + i * 20)}" y="${String(y)}" width="16" height="10" rx="2.5" fill="none" stroke="${INK}" stroke-width="2" opacity="0.35"/>`,
        )
        .join(""),
    )
    .join("");
  return shadowed(page) + band + rings + tiles + blanks + sparkle(142, 26, 7, WHITE);
}
