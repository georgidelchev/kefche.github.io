// Nine Men's Morris sticker art (`pnpm art:generate`): the three nested
// squares on a wooden board, a closed mill of orange pieces along the top,
// and a blue piece popping off. Drawn in a 160 × 120 box with the shared kit.
// Piece colours are --player-1 and --player-2.

const ORANGE = "#e69f00";
const BLUE = "#56b4e9";
const WOOD = "#e2c08d";
const LINE = "#5a3d1c";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, shadowed, sparkle }) {
  const s = 14;
  const x0 = 38;
  const y0 = 14;
  const p = (c, r) => [x0 + c * s, y0 + r * s];
  const sq = (a, b) => {
    const [x1, y1] = p(a, a);
    const [x2, y2] = p(b, b);
    return `<rect x="${String(x1)}" y="${String(y1)}" width="${String(x2 - x1)}" height="${String(y2 - y1)}" fill="none" stroke="${LINE}" stroke-width="2.4"/>`;
  };
  const [mx] = p(3, 0);
  const [, my] = p(0, 3);
  const cross = `<path d="M${String(mx)} ${String(y0)}V${String(y0 + 2 * s)}M${String(mx)} ${String(y0 + 4 * s)}V${String(y0 + 6 * s)}M${String(x0)} ${String(my)}H${String(x0 + 2 * s)}M${String(x0 + 4 * s)} ${String(my)}H${String(x0 + 6 * s)}" stroke="${LINE}" stroke-width="2.4"/>`;
  const piece = (c, r, fill) => {
    const [cx, cy] = p(c, r);
    return `<circle cx="${String(cx)}" cy="${String(cy)}" r="7.5" fill="${fill}" stroke="${INK}" stroke-width="2.6"/>`;
  };
  const board =
    `<rect x="${String(x0 - 10)}" y="${String(y0 - 10)}" width="${String(6 * s + 20)}" height="${String(6 * s + 20)}" rx="8" fill="${WOOD}" stroke="${INK}" stroke-width="4"/>` +
    sq(0, 6) +
    sq(1, 5) +
    sq(2, 4) +
    cross +
    piece(0, 0, ORANGE) +
    piece(3, 0, ORANGE) +
    piece(6, 0, ORANGE) +
    piece(1, 5, BLUE) +
    piece(4, 3, BLUE);
  const popped =
    `<circle cx="136" cy="78" r="8" fill="${BLUE}" stroke="${INK}" stroke-width="2.6"/>` +
    `<path d="M124 86l-5 4M127 92l-3 5" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
  return (
    shadowed(`<g transform="rotate(-4 80 60)">${board}</g>`) +
    shadowed(popped, 3, 3) +
    sparkle(22, 24, 6) +
    sparkle(144, 26)
  );
}
