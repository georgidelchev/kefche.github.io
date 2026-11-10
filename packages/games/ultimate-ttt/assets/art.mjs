// Ultimate Tic-Tac-Toe sticker art (`pnpm art:generate`): a 3 × 3 grid of
// little boards, two of them won with a big orange circle and a blue
// square. Drawn in a 160 × 120 box with the shared kit. Colours are
// --player-1 and --player-2.

const ORANGE = "#e69f00";
const BLUE = "#56b4e9";
const CELL = "#ffffff";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, shadowed, sparkle }) {
  const s = 28;
  const x0 = 38;
  const y0 = 14;
  let boards = "";
  for (let b = 0; b < 9; b++) {
    const bx = x0 + (b % 3) * (s + 2);
    const by = y0 + Math.floor(b / 3) * (s + 2);
    boards += `<rect x="${String(bx)}" y="${String(by)}" width="${String(s)}" height="${String(s)}" rx="4" fill="${CELL}" stroke="${INK}" stroke-width="2"/>`;
    boards += `<path d="M${String(bx + s / 3)} ${String(by + 3)}v${String(s - 6)}M${String(bx + (2 * s) / 3)} ${String(by + 3)}v${String(s - 6)}M${String(bx + 3)} ${String(by + s / 3)}h${String(s - 6)}M${String(bx + 3)} ${String(by + (2 * s) / 3)}h${String(s - 6)}" stroke="#c9cfdc" stroke-width="1.4"/>`;
  }
  const at = (b) => [x0 + (b % 3) * (s + 2) + s / 2, y0 + Math.floor(b / 3) * (s + 2) + s / 2];
  const [cx, cy] = at(4);
  const [qx, qy] = at(2);
  const marks =
    `<circle cx="${String(cx)}" cy="${String(cy)}" r="10" fill="${ORANGE}" stroke="${INK}" stroke-width="2.6"/>` +
    `<rect x="${String(qx - 9)}" y="${String(qy - 9)}" width="18" height="18" rx="3" fill="${BLUE}" stroke="${INK}" stroke-width="2.6"/>`;
  return shadowed(boards) + marks + sparkle(22, 26, 6) + sparkle(144, 98);
}
