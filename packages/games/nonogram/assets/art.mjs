// Nonogram sticker art (`pnpm art:generate`): a small grid with its number
// clues, a heart filled in, and a pencil. Drawn in a 160 × 120 box with the
// shared kit (its hand-drawn digits).

const PAPER = "#ffffff";
const FILL = "#141826";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, shadowed, sparkle, digits }) {
  const s = 12;
  const x0 = 54;
  const y0 = 34;
  const heart = ["01010", "11111", "11111", "01110", "00100"];
  let cells = "";
  heart.forEach((row, r) =>
    [...row].forEach((v, c) => {
      cells += `<rect x="${String(x0 + c * s)}" y="${String(y0 + r * s)}" width="${String(s)}" height="${String(s)}" fill="${v === "1" ? FILL : PAPER}" stroke="#9aa3b5" stroke-width="1"/>`;
    }),
  );
  const rowClues = ["11", "5", "5", "3", "1"];
  const colClues = ["2", "4", "4", "4", "2"];
  let clues = "";
  rowClues.forEach((t, r) => {
    clues += digits(Number(t), x0 - 9, y0 + r * s + s / 2, 8, INK, 2);
  });
  colClues.forEach((t, c) => {
    clues += digits(Number(t), x0 + c * s + s / 2, y0 - 8, 8, INK, 2);
  });
  const paper = `<rect x="${String(x0 - 22)}" y="${String(y0 - 20)}" width="${String(5 * s + 30)}" height="${String(5 * s + 28)}" rx="6" fill="${PAPER}" stroke="${INK}" stroke-width="3.6"/>`;
  const pencil = `<g transform="rotate(35 132 66)"><rect x="126" y="34" width="12" height="46" rx="2" fill="#ffd84a" stroke="${INK}" stroke-width="2.4"/><path d="M126 80l6 12 6-12z" fill="#f3d7b0" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/></g>`;
  return (
    shadowed(paper) +
    cells +
    clues +
    shadowed(pencil, 2, 2) +
    sparkle(22, 24, 6) +
    sparkle(146, 104)
  );
}
