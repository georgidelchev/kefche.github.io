// Nim sticker art (`pnpm art:generate`): three rows of matchsticks on green
// felt, one stick being lifted away. Drawn in a 160 × 120 box with the
// shared kit.

const FELT = "#2f5d46";
const STICK = "#e8bf6a";
const HEAD = "#c0392b";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, shadowed, sparkle }) {
  const stick = (x, y, rot = 0) =>
    `<g transform="rotate(${String(rot)} ${String(x)} ${String(y + 12)})"><rect x="${String(x - 2.6)}" y="${String(y)}" width="5.2" height="24" rx="2.6" fill="${STICK}" stroke="${INK}" stroke-width="1.8"/><ellipse cx="${String(x)}" cy="${String(y)}" rx="3.6" ry="4" fill="${HEAD}" stroke="${INK}" stroke-width="1.8"/></g>`;
  let sticks = "";
  const rows = [1, 3, 5];
  rows.forEach((n, r) => {
    for (let i = 0; i < n; i++) sticks += stick(56 + i * 12, 24 + r * 28);
  });
  const board =
    `<rect x="34" y="14" width="96" height="94" rx="12" fill="${FELT}" stroke="${INK}" stroke-width="4"/>` +
    sticks;
  return (
    shadowed(board) + shadowed(stick(140, 30, 24), 2, 2) + sparkle(22, 30, 6) + sparkle(20, 96)
  );
}
