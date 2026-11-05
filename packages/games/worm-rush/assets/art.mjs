// Worm Rush sticker art (`pnpm art:generate`): a striped worm of round
// segments, as the game draws worms, rising toward glowing orbs. Drawn in a
// 160 × 120 box with the shared kit.

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  // Segments from the tail up to the neck, on a gentle S: x, y, radius.
  const segments = [
    [18, 98, 8],
    [28, 92, 9],
    [39, 88, 10],
    [51, 88, 11],
    [63, 86, 12],
    [74, 80, 12.5],
    [83, 71, 13],
    [90, 60, 13.5],
    [97, 50, 14],
  ];
  // The game's blue skin with white stripes, three segments each.
  const body = segments
    .map(
      ([x, y, r], i) =>
        `<circle cx="${x}" cy="${y}" r="${r}" fill="${Math.floor(i / 3) % 2 === 0 ? "#3a9bff" : WHITE}" stroke="${INK}" stroke-width="3.5"/>`,
    )
    .join("");
  const head =
    `<circle cx="108" cy="38" r="17" fill="#3a9bff" stroke="${INK}" stroke-width="4"/>` +
    `<circle cx="104" cy="31" r="6.5" fill="${WHITE}" stroke="${INK}" stroke-width="2.5"/>` +
    `<circle cx="118" cy="34" r="6.5" fill="${WHITE}" stroke="${INK}" stroke-width="2.5"/>` +
    `<circle cx="106" cy="30" r="2.8" fill="${INK}"/><circle cx="120" cy="33" r="2.8" fill="${INK}"/>`;
  const orb = (x, y, r, fill) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${INK}" stroke-width="3"/>` +
    `<circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.3}" fill="${WHITE}"/>`;
  const orbs =
    orb(140, 72, 10, "#ffd166") +
    orb(126, 96, 7, "#06d6a0") +
    orb(146, 102, 5, "#ef476f") +
    orb(40, 46, 7, "#c77dff");
  return (
    shadowed(body, 3, 3) +
    shadowed(head, 3, 3) +
    shadowed(orbs, 2, 2) +
    sparkle(146, 28, 8) +
    sparkle(58, 30, 5)
  );
}
