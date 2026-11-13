// Speed Typing sticker art (`pnpm art:generate`): a keyboard seen at a
// slant, three keys pressed, with speed lines flying off to the right.
// No text, so the art renders the same everywhere.

const BODY = "#334155";
const KEY = "#f8fafc";
const HOT = "#f59e0b";
const LINE = "#38bdf8";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const body = `<rect x="14" y="44" width="112" height="58" rx="10" fill="${BODY}" stroke="${INK}" stroke-width="4"/>`;
  let keys = "";
  const rows = [
    [22, 52, 8],
    [27, 68, 7],
    [36, 84, 5],
  ];
  rows.forEach(([x0, y, n], r) => {
    for (let i = 0; i < n; i++) {
      const hot = (r === 0 && i === 2) || (r === 1 && i === 4) || (r === 2 && i === 1);
      keys += `<rect x="${String(x0 + i * 13)}" y="${String(y)}" width="10" height="11" rx="2.5" fill="${hot ? HOT : KEY}" stroke="${INK}" stroke-width="1.8"/>`;
    }
  });
  // The space bar.
  keys += `<rect x="${String(36 + 5 * 13)}" y="84" width="16" height="11" rx="2.5" fill="${KEY}" stroke="${INK}" stroke-width="1.8"/>`;
  const lines = [30, 44, 58]
    .map(
      (y, i) =>
        `<path d="M${String(132 + i * 2)} ${String(y)} H${String(152 - i * 3)}" stroke="${LINE}" stroke-width="5" stroke-linecap="round"/>`,
    )
    .join("");
  const cursor = `<rect x="58" y="16" width="6" height="22" rx="2" fill="${WHITE}" stroke="${INK}" stroke-width="3"/>`;
  return shadowed(body) + keys + lines + cursor + sparkle(26, 24) + sparkle(146, 96, 6, WHITE);
}
