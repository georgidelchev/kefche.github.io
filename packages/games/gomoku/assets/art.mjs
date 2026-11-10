// Gomoku sticker art (`pnpm art:generate`): a corner of the wooden grid with
// a diagonal of five black stones struck through, and white stones around
// it. Drawn in a 160 × 120 box with the shared kit.

const WOOD = "#dcb36b";
const LINE = "#5a4220";
const BLACK = "#1b1b1b";
const WHITE_STONE = "#f4f4ef";
const RED = "#c0392b";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, shadowed, sparkle }) {
  const step = 15;
  const x0 = 36;
  const y0 = 18;
  const n = 6;
  let lines = "";
  for (let i = 0; i < n; i++) {
    lines += `<path d="M${String(x0)} ${String(y0 + i * step)}h${String(step * (n - 1))}M${String(x0 + i * step)} ${String(y0)}v${String(step * (n - 1))}" stroke="${LINE}" stroke-width="1.8"/>`;
  }
  const at = (c, r) => [x0 + c * step, y0 + r * step];
  const stone = (c, r, fill) => {
    const [cx, cy] = at(c, r);
    return `<circle cx="${String(cx)}" cy="${String(cy)}" r="6.6" fill="${fill}" stroke="${INK}" stroke-width="2.2"/>`;
  };
  const five = [0, 1, 2, 3, 4].map((i) => stone(i, 4 - i, BLACK)).join("");
  const whites = [
    stone(1, 4, WHITE_STONE),
    stone(2, 3, WHITE_STONE),
    stone(3, 3, WHITE_STONE),
    stone(4, 2, WHITE_STONE),
  ].join("");
  const [ax, ay] = at(0, 4);
  const [bx, by] = at(4, 0);
  const strike = `<path d="M${String(ax - 6)} ${String(ay + 6)}L${String(bx + 6)} ${String(by - 6)}" stroke="${RED}" stroke-width="3.4" stroke-linecap="round"/>`;
  const board =
    `<g transform="rotate(-5 80 60)"><rect x="${String(x0 - 10)}" y="${String(y0 - 10)}" width="${String(step * (n - 1) + 20)}" height="${String(step * (n - 1) + 20)}" rx="8" fill="${WOOD}" stroke="${INK}" stroke-width="4"/>` +
    lines +
    whites +
    five +
    strike +
    `</g>`;
  return shadowed(board) + sparkle(142, 30) + sparkle(22, 94, 6);
}
