// Who's the Spy sticker art (`pnpm art:generate`): three faces in a row,
// one of them in a hat and dark glasses, and a question mark. Drawn in a
// 160 × 120 box with the shared kit.

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, shadowed, sparkle }) {
  const face = (x, fill) =>
    `<circle cx="${String(x)}" cy="72" r="22" fill="${fill}" stroke="${INK}" stroke-width="4"/>` +
    `<circle cx="${String(x - 7)}" cy="68" r="3" fill="${INK}"/><circle cx="${String(x + 7)}" cy="68" r="3" fill="${INK}"/>` +
    `<path d="M${String(x - 7)} 80 q7 6 14 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  const spy =
    `<circle cx="80" cy="64" r="24" fill="#f4c49b" stroke="${INK}" stroke-width="4"/>` +
    `<path d="M54 50 h52 l-6 -16 h-40 z" fill="#2b2f3a" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="M48 50 h64" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>` +
    `<rect x="64" y="58" width="13" height="9" rx="3" fill="#141826"/><rect x="83" y="58" width="13" height="9" rx="3" fill="#141826"/>` +
    `<path d="M77 62 h6" stroke="#141826" stroke-width="3"/>` +
    `<path d="M72 76 h16" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
  const mark = `<text x="136" y="40" font-size="30" font-weight="900" font-family="sans-serif" fill="#e69f00" stroke="${INK}" stroke-width="2.5">?</text>`;
  return (
    shadowed(face(30, "#56b4e9")) +
    shadowed(face(130, "#009e73")) +
    shadowed(spy) +
    mark +
    sparkle(22, 26)
  );
}
