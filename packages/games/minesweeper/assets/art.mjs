// Minesweeper sticker art (`pnpm art:generate`): a corner of the field with
// opened numbers, a red flag and a mine. Drawn in a 160 × 120 box with the
// shared kit (its hand-drawn digits).

const HIDDEN = "#d7dce6";
const OPEN = "#f4f6fa";
const COLOURS = { 1: "#1f5fbf", 2: "#2e7d32", 3: "#c62828" };

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, shadowed, sparkle, digits }) {
  const s = 20;
  const x0 = 40;
  const y0 = 18;
  const grid = [
    [1, 1, 2, -1],
    [0, 0, 3, -1],
    [1, 1, 2, -2],
    [-1, -1, -1, -1],
  ];
  let cells = "";
  grid.forEach((row, r) =>
    row.forEach((v, c) => {
      const x = x0 + c * (s + 2);
      const y = y0 + r * (s + 2);
      cells += `<rect x="${String(x)}" y="${String(y)}" width="${String(s)}" height="${String(s)}" rx="3" fill="${v >= 0 ? OPEN : HIDDEN}" stroke="${INK}" stroke-width="1.8"/>`;
      if (v > 0) cells += digits(v, x + s / 2, y + s / 2, 11, COLOURS[v], 2.4);
      if (v === -2)
        cells += `<path d="M${String(x + 7)} ${String(y + 16)}V${String(y + 4)}l8 3-8 3" fill="#c62828" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
    }),
  );
  const frame = `<rect x="${String(x0 - 6)}" y="${String(y0 - 6)}" width="${String(4 * (s + 2) + 10)}" height="${String(4 * (s + 2) + 10)}" rx="8" fill="#8a94a8" stroke="${INK}" stroke-width="4"/>`;
  const mine =
    `<circle cx="138" cy="84" r="10" fill="${INK}"/>` +
    `<path d="M138 70v28M124 84h28M128 74l20 20M148 74l-20 20" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="134" cy="80" r="3" fill="#ffffff"/>`;
  return shadowed(frame + cells) + mine + sparkle(146, 22) + sparkle(20, 100, 6);
}
