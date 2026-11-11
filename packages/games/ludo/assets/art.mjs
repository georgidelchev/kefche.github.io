// Ludo sticker art (`pnpm art:generate`): the cross of the board with a
// coloured corner, tokens on the track, and a die. Drawn in a 160 × 120 box
// with the shared kit.

const COLOURS = ["#e69f00", "#56b4e9", "#009e73", "#f0e442"];

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  let board = `<rect x="20" y="10" width="100" height="100" rx="8" fill="${WHITE}" stroke="${INK}" stroke-width="4"/>`;
  const corners = [
    [20, 10],
    [80, 10],
    [80, 70],
    [20, 70],
  ];
  corners.forEach(([x, y], i) => {
    board += `<rect x="${String(x + 3)}" y="${String(y + 3)}" width="34" height="34" rx="6" fill="${COLOURS[i]}" stroke="${INK}" stroke-width="2"/>`;
  });
  board += `<path d="M60 50L80 50L70 60Z" fill="${COLOURS[1]}"/><path d="M80 50L80 70L70 60Z" fill="${COLOURS[2]}"/><path d="M60 70L80 70L70 60Z" fill="${COLOURS[3]}"/><path d="M60 50L60 70L70 60Z" fill="${COLOURS[0]}"/>`;
  const token = (x, y, c) =>
    `<circle cx="${String(x)}" cy="${String(y)}" r="7" fill="${c}" stroke="${INK}" stroke-width="2.5"/>`;
  const tokens = token(48, 60, COLOURS[0]) + token(70, 30, COLOURS[1]) + token(92, 60, COLOURS[2]);
  const die =
    `<g transform="rotate(12 136 88)"><rect x="120" y="72" width="32" height="32" rx="6" fill="${WHITE}" stroke="${INK}" stroke-width="3.5"/>` +
    [
      [128, 80],
      [144, 80],
      [128, 88],
      [144, 88],
      [128, 96],
      [144, 96],
    ]
      .map(([x, y]) => `<circle cx="${String(x)}" cy="${String(y)}" r="2.6" fill="${INK}"/>`)
      .join("") +
    `</g>`;
  return shadowed(board) + shadowed(tokens, 2, 2) + shadowed(die) + sparkle(140, 24);
}
