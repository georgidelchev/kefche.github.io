// Go sticker art (`pnpm art:generate`): a tilted corner of the wooden board
// with its grid, a star point, and black and white stones around a capture.
// Drawn in a 160 × 120 box with the shared kit.

const WOOD = "#dcb36b";
const LINE = "#3d2b12";
const BLACK = "#1b1b1b";
const WHITE_STONE = "#f4f4ef";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, shadowed, sparkle }) {
  const step = 18;
  const x0 = 40;
  const y0 = 24;
  const n = 5;
  let lines = "";
  for (let i = 0; i < n; i++) {
    lines += `<path d="M${String(x0)} ${String(y0 + i * step)}h${String(step * (n - 1))}M${String(x0 + i * step)} ${String(y0)}v${String(step * (n - 1))}" stroke="${LINE}" stroke-width="2"/>`;
  }
  const at = (c, r) => [x0 + c * step, y0 + r * step];
  const [sx, sy] = at(2, 2);
  const star = `<circle cx="${String(sx)}" cy="${String(sy)}" r="3" fill="${LINE}"/>`;
  const stone = (c, r, fill) => {
    const [cx, cy] = at(c, r);
    return `<circle cx="${String(cx)}" cy="${String(cy)}" r="8" fill="${fill}" stroke="${INK}" stroke-width="2.6"/>`;
  };
  const stones = [
    stone(1, 1, BLACK),
    stone(2, 1, BLACK),
    stone(3, 2, BLACK),
    stone(1, 3, WHITE_STONE),
    stone(2, 3, BLACK),
    stone(3, 3, WHITE_STONE),
    stone(1, 2, WHITE_STONE),
    stone(0, 3, WHITE_STONE),
  ].join("");
  const [hx, hy] = at(4, 1);
  const shine = `<path d="M${String(hx - 3)} ${String(hy - 4)}q2-2 5-1" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>`;
  const board =
    `<g transform="rotate(-5 80 60)"><rect x="${String(x0 - 12)}" y="${String(y0 - 12)}" width="${String(step * (n - 1) + 24)}" height="${String(step * (n - 1) + 24)}" rx="8" fill="${WOOD}" stroke="${INK}" stroke-width="4"/>` +
    lines +
    star +
    stones +
    stone(4, 1, BLACK) +
    shine +
    `</g>`;
  return shadowed(board) + sparkle(142, 28) + sparkle(20, 94, 6);
}
