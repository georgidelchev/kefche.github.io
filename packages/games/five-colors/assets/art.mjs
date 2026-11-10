// Five Colors sticker art (`pnpm art:generate`): a corner of the grid with
// stones in five player colours, and an orange line of four struck through.
// Drawn in a 160 × 120 box with the shared kit. Colours are --player-1 to 5.

const COLOURS = ["#e69f00", "#56b4e9", "#009e73", "#cc79a7", "#f0e442"];
const WOOD = "#dcb36b";
const LINE = "#5a4220";
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
  const stone = (c, r, k) => {
    const [cx, cy] = at(c, r);
    return `<circle cx="${String(cx)}" cy="${String(cy)}" r="6.6" fill="${COLOURS[k] ?? COLOURS[0]}" stroke="${INK}" stroke-width="2.2"/>`;
  };
  const row = [1, 2, 3, 4].map((c) => stone(c, 2, 0)).join("");
  const others = [
    stone(1, 1, 1),
    stone(3, 3, 2),
    stone(2, 4, 3),
    stone(4, 1, 4),
    stone(0, 3, 1),
    stone(5, 4, 2),
  ].join("");
  const [ax, ay] = at(1, 2);
  const [bx] = at(4, 2);
  const strike = `<path d="M${String(ax - 8)} ${String(ay)}H${String(bx + 8)}" stroke="${RED}" stroke-width="3.4" stroke-linecap="round"/>`;
  const board =
    `<g transform="rotate(4 80 60)"><rect x="${String(x0 - 10)}" y="${String(y0 - 10)}" width="${String(step * (n - 1) + 20)}" height="${String(step * (n - 1) + 20)}" rx="8" fill="${WOOD}" stroke="${INK}" stroke-width="4"/>` +
    lines +
    others +
    row +
    strike +
    `</g>`;
  return shadowed(board) + sparkle(20, 26, 6) + sparkle(144, 96);
}
