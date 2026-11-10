// Checkers sticker art (`pnpm art:generate`): a tilted corner of the wooden
// board, an orange king with its crown, and a blue piece being jumped, with
// the jump's arc. Drawn in a 160 × 120 box with the shared kit. Piece colours
// are --player-1 and --player-2.

const ORANGE = "#e69f00";
const BLUE = "#56b4e9";
const LIGHT = "#ecd3a8";
const DARK = "#a8703f";
const GOLD = "#ffd84a";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, shadowed, sparkle }) {
  const cell = 22;
  const x0 = 36;
  const y0 = 18;
  let squares = "";
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      squares += `<rect x="${String(x0 + c * cell)}" y="${String(y0 + r * cell)}" width="${String(cell)}" height="${String(cell)}" fill="${(r + c) % 2 === 1 ? DARK : LIGHT}"/>`;
    }
  }
  const at = (c, r) => [x0 + c * cell + cell / 2, y0 + r * cell + cell / 2];
  const piece = (c, r, fill) => {
    const [cx, cy] = at(c, r);
    return (
      `<circle cx="${String(cx)}" cy="${String(cy + 2)}" r="8.5" fill="${INK}"/>` +
      `<circle cx="${String(cx)}" cy="${String(cy)}" r="8.5" fill="${fill}" stroke="${INK}" stroke-width="2.6"/>` +
      `<circle cx="${String(cx)}" cy="${String(cy)}" r="4.5" fill="none" stroke="${INK}" stroke-width="1.6" opacity="0.5"/>`
    );
  };
  const [kx, ky] = at(0, 3);
  const crown = `<path d="M${String(kx - 7)} ${String(ky - 6)}h14l-1.5-8-3.5 3-2-5-2 5-3.5-3z" fill="${GOLD}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
  const [bx, by] = at(1, 2);
  const [lx, ly] = at(2, 1);
  const arc = `<path d="M${String(kx + 4)} ${String(ky - 12)}Q${String(bx - 6)} ${String(by - 26)} ${String(lx - 2)} ${String(ly - 4)}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="1 5"/>`;
  const board =
    `<g transform="rotate(-6 80 62)"><rect x="${String(x0 - 4)}" y="${String(y0 - 4)}" width="${String(cell * 4 + 8)}" height="${String(cell * 4 + 8)}" rx="8" fill="#6b4426" stroke="${INK}" stroke-width="4"/>` +
    squares +
    piece(1, 2, BLUE) +
    piece(3, 0, BLUE) +
    piece(3, 2, ORANGE) +
    piece(0, 3, ORANGE) +
    crown +
    arc +
    `</g>`;
  return shadowed(board) + sparkle(140, 24) + sparkle(22, 96, 6);
}
