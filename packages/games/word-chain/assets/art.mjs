// Word Chain sticker art (`pnpm art:generate`): three letter tiles rising
// left to right, joined by chain links. Letters are simple strokes (no
// text), so the art renders the same everywhere.

const TILE = "#fef3c7";
const LINK = "#0d9488";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const spots = [
    [14, 70],
    [62, 46],
    [110, 22],
  ];
  let tiles = "";
  for (const [x, y] of spots) {
    tiles += `<rect x="${String(x)}" y="${String(y)}" width="36" height="36" rx="7" fill="${TILE}" stroke="${INK}" stroke-width="3.5"/>`;
  }
  // Strokes for the letters: an A, an E and an S-like curve.
  const [a, e, s] = spots.map(([x, y]) => [x + 18, y + 18]);
  const letters = `<g fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M${String(a[0] - 8)} ${String(a[1] + 10)} L${String(a[0])} ${String(a[1] - 10)} L${String(a[0] + 8)} ${String(a[1] + 10)} M${String(a[0] - 4.5)} ${String(a[1] + 3)} H${String(a[0] + 4.5)}"/><path d="M${String(e[0] + 7)} ${String(e[1] - 10)} H${String(e[0] - 7)} V${String(e[1] + 10)} H${String(e[0] + 7)} M${String(e[0] - 7)} ${String(e[1])} H${String(e[0] + 4)}"/><path d="M${String(s[0] + 7)} ${String(s[1] - 8)} C${String(s[0] + 2)} ${String(s[1] - 13)} ${String(s[0] - 9)} ${String(s[1] - 9)} ${String(s[0] - 6)} ${String(s[1] - 3)} C${String(s[0] - 3)} ${String(s[1] + 2)} ${String(s[0] + 9)} ${String(s[1] + 1)} ${String(s[0] + 7)} ${String(s[1] + 7)} C${String(s[0] + 5)} ${String(s[1] + 13)} ${String(s[0] - 5)} ${String(s[1] + 12)} ${String(s[0] - 8)} ${String(s[1] + 8)}"/></g>`;
  // Two links between each pair of tiles, tilted along the rise.
  let links = "";
  for (let i = 0; i < 2; i++) {
    const [x1, y1] = spots[i];
    const cx = x1 + 42;
    const cy = y1 + 6;
    links += `<g transform="rotate(-27 ${String(cx)} ${String(cy)})" fill="none" stroke-width="5"><rect x="${String(cx - 11)}" y="${String(cy - 5)}" width="14" height="10" rx="5" stroke="${LINK}"/><rect x="${String(cx - 3)}" y="${String(cy - 5)}" width="14" height="10" rx="5" stroke="${LINK}"/></g>`;
  }
  return shadowed(tiles) + links + letters + sparkle(146, 76) + sparkle(22, 30, 6, WHITE);
}
