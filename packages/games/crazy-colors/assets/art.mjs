// Crazy Colors sticker art (`pnpm art:generate`): a fan of three cards in
// the game's colours, each with its shape, and a Wild on top. Drawn in a
// 160 × 120 box with the shared kit.

const COLOURS = ["#e69f00", "#56b4e9", "#009e73", "#f0e442"];
const SHAPES = [
  "M12 6.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z",
  "M7.5 6.5h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z",
  "M12 5.5 18.5 17.5h-13z",
  "M12 4.5 19.5 12 12 19.5 4.5 12z",
];

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const card = (angle, colour, label) =>
    `<g transform="rotate(${String(angle)} 80 112)">` +
    `<rect x="56" y="22" width="48" height="68" rx="7" fill="${colour}" stroke="${INK}" stroke-width="4"/>` +
    `<ellipse cx="80" cy="56" rx="17" ry="25" fill="${WHITE}"/>` +
    label +
    `</g>`;
  const number = (n) =>
    `<text x="80" y="65" font-family="system-ui, sans-serif" font-weight="800" font-size="26" text-anchor="middle" fill="${INK}">${n}</text>`;
  const wild = SHAPES.map(
    (d, i) =>
      `<path d="${d}" transform="translate(${String(66 + (i % 2) * 13)} ${String(41 + Math.floor(i / 2) * 14)}) scale(0.6)" fill="${COLOURS[i]}" stroke="${INK}" stroke-width="1.5"/>`,
  ).join("");
  return (
    shadowed(card(-24, COLOURS[1], number("7"))) +
    shadowed(card(-8, COLOURS[2], number("+2"))) +
    shadowed(card(10, COLOURS[0], number("3"))) +
    shadowed(card(26, "#2b2f3a", wild)) +
    sparkle(26, 24, 6) +
    sparkle(136, 22)
  );
}
