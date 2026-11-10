// Chinese Checkers sticker art (`pnpm art:generate`): a six-pointed star of
// holes with coloured marbles in its points, and one marble mid-jump. Drawn
// in a 160 × 120 box with the shared kit. Colours are --player-1 to 6.

const COLOURS = ["#e69f00", "#56b4e9", "#009e73", "#cc79a7", "#f0e442", "#0072b2"];
const BOARD = "#f4ead5";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, shadowed, sparkle }) {
  const s = 6.2;
  const cx = 80;
  const cy = 60;
  let holes = "";
  for (let x = -8; x <= 8; x++) {
    for (let y = -8; y <= 8; y++) {
      const z = -x - y;
      const c = [x, y, z];
      if (!c.every((v) => v >= -4) && !c.every((v) => v <= 4)) continue;
      const px = cx + (x + z / 2) * s;
      const py = cy + z * s * 0.866;
      const arm = [
        [2, -1],
        [0, 1],
        [1, -1],
        [2, 1],
        [0, -1],
        [1, 1],
      ].findIndex(([axis, sign]) => c[axis] * sign > 4);
      const fill = arm >= 0 && arm % 2 === 0 ? COLOURS[arm] : arm >= 0 ? COLOURS[arm] : "#d8cdb3";
      const r = arm >= 0 ? 2.5 : 1.3;
      holes += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${String(r)}" fill="${fill}" stroke="${INK}" stroke-width="${arm >= 0 ? 0.9 : 0.6}"/>`;
    }
  }
  const star = `<polygon points="80,4 101,40 142,40 121,76 142,112 80,112 18,112 39,76 18,40 59,40" fill="${BOARD}" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/>`;
  const hop = `<path d="M80 60q8-14 16 0" fill="none" stroke="${INK}" stroke-width="1.8" stroke-dasharray="1 3" stroke-linecap="round"/>`;
  return shadowed(star) + holes + hop + sparkle(146, 16, 6) + sparkle(14, 18, 5);
}
