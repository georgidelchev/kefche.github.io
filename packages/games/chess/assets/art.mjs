// Chess sticker art (`pnpm art:generate`): a big white knight in front of a
// tilted corner of the "sand" board. Drawn in a 160 × 120 box with the
// shared kit. The knight is the cburnett piece (BSD 3-Clause, see
// CREDITS.md), scaled up so its outline reads as the sticker's ink line.

const LIGHT = "#f3e0bf";
const DARK = "#b98a55";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const cell = 22;
  const x0 = 26;
  const y0 = 18;
  let squares = "";
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if ((row + col) % 2 === 1) {
        squares += `<rect x="${String(x0 + col * cell)}" y="${String(y0 + row * cell)}" width="${String(cell)}" height="${String(cell)}" fill="${DARK}"/>`;
      }
    }
  }
  const outline = `x="${String(x0)}" y="${String(y0)}" width="${String(cell * 4)}" height="${String(cell * 4)}" rx="8"`;
  const tilt = `transform="rotate(-8 70 62)"`;
  // The squares are clipped to the board's rounded corners.
  const board =
    shadowed(`<g ${tilt}><rect ${outline} fill="${LIGHT}"/></g>`) +
    `<g ${tilt}><clipPath id="chess-board"><rect ${outline}/></clipPath>` +
    `<g clip-path="url(#chess-board)">${squares}</g>` +
    `<rect ${outline} fill="none" stroke="${INK}" stroke-width="4"/></g>`;
  const knight =
    `<g transform="translate(58 14) scale(2.15)" stroke="${INK}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M22 10C32.5 11 38.5 18 38 39H15C15 30 25 32.5 23 18" fill="${WHITE}"/>` +
    `<path d="M24 18C24.38 20.91 18.45 25.37 16 27C13 29 13.18 31.34 11 31C9.958 30.06 12.41 27.96 11 28C10 28 11.19 29.23 10 30C9 30 5.997 31 6 26C6 24 12 14 12 14C12 14 13.89 12.1 14 10.5C13.27 9.506 13.5 8.5 13.5 7.5C14.5 6.5 16.5 10 16.5 10H18.5C18.5 10 19.28 8.008 21 7C22 7 22 10 22 10" fill="${WHITE}"/>` +
    `<path d="M9.5 25.5A0.5 0.5 0 1 1 8.5 25.5A0.5 0.5 0 1 1 9.5 25.5Z" fill="${INK}"/>` +
    `<path d="M15 15.5A0.5 1.5 0 1 1 14 15.5A0.5 1.5 0 1 1 15 15.5Z" transform="matrix(0.866 0.5 -0.5 0.866 9.693 -5.173)" fill="${INK}"/>` +
    `</g>`;
  return board + shadowed(knight) + sparkle(146, 22) + sparkle(18, 100, 6);
}
