// Box Pusher sticker art (`pnpm art:generate`): a corner of the warehouse,
// with one crate already on its goal, one being pushed towards the other
// goal, and the player behind it. Drawn in a 160 × 120 box with the shared kit.

const WALL = "#6b4f3a";
const FLOOR = "#e9e2d0";
const CRATE = "#c98b3c";
const PLACED = "#0f8a63";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const s = 22;
  const x0 = 36;
  const y0 = 16;
  const cell = (c, r) => [x0 + c * s, y0 + r * s];
  // 4 × 4: walls on the top row and the left column, floor elsewhere.
  let tiles = "";
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const [x, y] = cell(c, r);
      const wall = r === 0 || c === 0;
      tiles += `<rect x="${String(x)}" y="${String(y)}" width="${String(s)}" height="${String(s)}" fill="${wall ? WALL : FLOOR}"/>`;
    }
  }
  const frame = `<rect x="${String(x0)}" y="${String(y0)}" width="${String(4 * s)}" height="${String(4 * s)}" rx="6" fill="${FLOOR}" stroke="${INK}" stroke-width="4"/>`;
  const goal = (c, r) => {
    const [x, y] = cell(c, r);
    return `<circle cx="${String(x + s / 2)}" cy="${String(y + s / 2)}" r="5" fill="none" stroke="#b8460b" stroke-width="3"/>`;
  };
  const crate = (c, r, fill) => {
    const [x, y] = cell(c, r);
    return `<rect x="${String(x + 2)}" y="${String(y + 2)}" width="${String(s - 4)}" height="${String(s - 4)}" rx="3" fill="${fill}" stroke="${INK}" stroke-width="3"/><path d="M${String(x + 5)} ${String(y + 5)}l${String(s - 10)} ${String(s - 10)}M${String(x + s - 5)} ${String(y + 5)}l-${String(s - 10)} ${String(s - 10)}" stroke="${INK}" stroke-width="2" opacity="0.45"/>`;
  };
  const [px, py] = cell(1, 3);
  const player =
    `<circle cx="${String(px + s / 2)}" cy="${String(py + s / 2)}" r="8" fill="#1f5fae" stroke="${INK}" stroke-width="3"/>` +
    `<circle cx="${String(px + s / 2 - 3)}" cy="${String(py + s / 2 - 2)}" r="1.8" fill="${WHITE}"/><circle cx="${String(px + s / 2 + 3)}" cy="${String(py + s / 2 - 2)}" r="1.8" fill="${WHITE}"/>`;
  return (
    shadowed(frame) +
    tiles +
    `<rect x="${String(x0)}" y="${String(y0)}" width="${String(4 * s)}" height="${String(4 * s)}" rx="6" fill="none" stroke="${INK}" stroke-width="4"/>` +
    goal(3, 1) +
    goal(1, 1) +
    crate(3, 1, PLACED) +
    crate(1, 2, CRATE) +
    player +
    sparkle(146, 26) +
    sparkle(18, 98, 6)
  );
}
