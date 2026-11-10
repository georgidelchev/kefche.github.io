// Hex sticker art (`pnpm art:generate`): a small rhombus of hexagons with
// orange edges top and bottom, blue edges left and right, and an orange
// chain winding from top to bottom. Drawn in a 160 × 120 box with the shared
// kit. Colours are --player-1 and --player-2.

const ORANGE = "#e69f00";
const BLUE = "#56b4e9";
const CELL = "#eef1f8";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, shadowed, sparkle }) {
  const n = 5;
  const w = 14;
  const R = w / Math.sqrt(3);
  const x0 = 34;
  const y0 = 22;
  const at = (r, c) => [x0 + (c + r / 2) * w, y0 + r * 1.5 * R];
  const hex = (r, c, fill) => {
    const [x, y] = at(r, c);
    const pts = Array.from({ length: 6 }, (_, k) => {
      const a = (Math.PI / 180) * (60 * k - 90);
      return `${(x + R * Math.cos(a)).toFixed(1)},${(y + R * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
    return `<polygon points="${pts}" fill="${fill}" stroke="${INK}" stroke-width="2"/>`;
  };
  const chain = new Set(["0,2", "1,2", "2,1", "3,1", "4,0"]);
  const blues = new Set(["1,3", "2,3", "3,3", "2,0"]);
  let cells = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const key = `${String(r)},${String(c)}`;
      cells += hex(r, c, chain.has(key) ? ORANGE : blues.has(key) ? BLUE : CELL);
    }
  }
  const [ax, ay] = at(0, 0);
  const [bx] = at(0, n - 1);
  const [cx, cy] = at(n - 1, 0);
  const [dx] = at(n - 1, n - 1);
  const edges =
    `<path d="M${String(ax - 7)} ${String(ay - 11)}H${String(bx + 7)}" stroke="${ORANGE}" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M${String(cx - 7)} ${String(cy + 11)}H${String(dx + 7)}" stroke="${ORANGE}" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M${String(ax - 10)} ${String(ay - 6)}L${String(cx - 10)} ${String(cy + 6)}" stroke="${BLUE}" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M${String(bx + 10)} ${String(ay - 6)}L${String(dx + 10)} ${String(cy + 6)}" stroke="${BLUE}" stroke-width="5" stroke-linecap="round"/>`;
  return shadowed(`<g>${edges}${cells}</g>`) + sparkle(24, 96, 6) + sparkle(146, 24);
}
