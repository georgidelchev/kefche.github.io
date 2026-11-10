// Pipe Link sticker art (`pnpm art:generate`): a dark grid with three pairs
// of numbered dots, two joined by fat pipes and one still being drawn.
// Drawn in a 160 × 120 box with the shared kit (its hand-drawn digits).

const PANEL = "#1d2333";
const COLOURS = ["#e69f00", "#56b4e9", "#009e73"];

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, shadowed, sparkle, digits }) {
  const s = 18;
  const x0 = 44;
  const y0 = 16;
  const at = (c, r) => [x0 + c * s + s / 2, y0 + r * s + s / 2];
  const pipe = (cells, colour) =>
    `<polyline points="${cells.map(([c, r]) => at(c, r).join(",")).join(" ")}" fill="none" stroke="${colour}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
  const dot = (c, r, k) => {
    const [x, y] = at(c, r);
    return (
      `<circle cx="${String(x)}" cy="${String(y)}" r="7" fill="${COLOURS[k]}" stroke="${INK}" stroke-width="2"/>` +
      digits(k + 1, x, y, 7, INK, 1.8)
    );
  };
  let grid = "";
  for (let i = 0; i <= 4; i++) {
    grid += `<path d="M${String(x0 + i * s)} ${String(y0)}v${String(4 * s)}M${String(x0)} ${String(y0 + i * s)}h${String(4 * s)}" stroke="#39415a" stroke-width="1"/>`;
  }
  const panel = `<rect x="${String(x0 - 4)}" y="${String(y0 - 4)}" width="${String(4 * s + 8)}" height="${String(4 * s + 8)}" rx="8" fill="${PANEL}" stroke="${INK}" stroke-width="4"/>`;
  const pipes =
    pipe(
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
        [3, 1],
      ],
      COLOURS[0],
    ) +
    pipe(
      [
        [0, 1],
        [0, 2],
        [0, 3],
        [1, 3],
      ],
      COLOURS[1],
    ) +
    pipe(
      [
        [1, 1],
        [2, 1],
        [2, 2],
      ],
      COLOURS[2],
    );
  const dots =
    dot(0, 0, 0) + dot(3, 1, 0) + dot(0, 1, 1) + dot(1, 3, 1) + dot(1, 1, 2) + dot(3, 3, 2);
  return shadowed(panel) + grid + pipes + dots + sparkle(146, 24) + sparkle(20, 100, 6);
}
