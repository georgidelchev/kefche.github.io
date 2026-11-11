// Conquest sticker art (`pnpm art:generate`): three territories joined by
// borders, each in a player's colour with its armies, and a die. Drawn in a
// 160 × 120 box with the shared kit.

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const nodes = [
    [38, 40, "#e69f00"],
    [92, 30, "#56b4e9"],
    [66, 86, "#009e73"],
  ];
  const lines = `<path d="M38 40 L92 30 L66 86 Z" fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
  const circles = nodes
    .map(
      ([x, y, c]) =>
        `<circle cx="${String(x)}" cy="${String(y)}" r="17" fill="${c}" stroke="${INK}" stroke-width="4"/>`,
    )
    .join("");
  const flag = `<path d="M92 30 V4 M92 6 L112 12 L92 18" fill="#d55e00" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  const die =
    `<g transform="rotate(14 128 86)"><rect x="110" y="68" width="36" height="36" rx="7" fill="${WHITE}" stroke="${INK}" stroke-width="3.5"/>` +
    [
      [119, 77],
      [137, 77],
      [128, 86],
      [119, 95],
      [137, 95],
    ]
      .map(([x, y]) => `<circle cx="${String(x)}" cy="${String(y)}" r="3" fill="${INK}"/>`)
      .join("") +
    `</g>`;
  return shadowed(lines + circles) + flag + shadowed(die) + sparkle(24, 96);
}
