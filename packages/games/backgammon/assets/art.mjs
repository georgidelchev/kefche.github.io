// Backgammon sticker art (`pnpm art:generate`): a corner of the board with
// points and checkers, and a pair of dice. Drawn in a 160 × 120 box with
// the shared kit.

const ORANGE = "#e69f00";
const BLUE = "#56b4e9";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  let points = "";
  for (let i = 0; i < 5; i++) {
    const x = 20 + i * 18;
    points += `<path d="M${String(x)} 26L${String(x + 9)} 76L${String(x + 18)} 26Z" fill="${i % 2 ? "#a3452a" : "#e9d6b1"}" stroke="${INK}" stroke-width="1.5"/>`;
  }
  const board =
    `<rect x="14" y="20" width="102" height="86" rx="8" fill="#6b4a2b" stroke="${INK}" stroke-width="4"/>` +
    points;
  const checker = (x, y, c) =>
    `<circle cx="${String(x)}" cy="${String(y)}" r="8" fill="${c}" stroke="${INK}" stroke-width="2.5"/>`;
  const checkers =
    checker(29, 34, ORANGE) +
    checker(29, 50, ORANGE) +
    checker(65, 34, BLUE) +
    checker(65, 50, BLUE) +
    checker(65, 66, BLUE);
  const die = (x, y, a, pips) =>
    `<g transform="rotate(${String(a)} ${String(x + 15)} ${String(y + 15)})"><rect x="${String(x)}" y="${String(y)}" width="30" height="30" rx="6" fill="${WHITE}" stroke="${INK}" stroke-width="3.5"/>` +
    pips
      .map(
        ([px, py]) => `<circle cx="${String(x + px)}" cy="${String(y + py)}" r="3" fill="${INK}"/>`,
      )
      .join("") +
    `</g>`;
  return (
    shadowed(board) +
    shadowed(checkers, 2, 2) +
    shadowed(
      die(108, 56, -12, [
        [8, 8],
        [15, 15],
        [22, 22],
      ]),
    ) +
    shadowed(
      die(124, 82, 14, [
        [8, 8],
        [22, 8],
        [8, 22],
        [22, 22],
      ]),
    ) +
    sparkle(144, 30)
  );
}
