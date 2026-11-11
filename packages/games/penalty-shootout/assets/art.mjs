// Penalty Shootout sticker art (`pnpm art:generate`): a goal with its net,
// a ball flying into the top corner and a keeper diving the wrong way.
// Drawn in a 160 × 120 box with the shared kit.

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  let net = "";
  for (let x = 30; x <= 130; x += 20)
    net += `<path d="M${String(x)} 24 V100" stroke="${INK}" stroke-width="1.5" opacity="0.3"/>`;
  for (let y = 40; y <= 90; y += 16)
    net += `<path d="M14 ${String(y)} H146" stroke="${INK}" stroke-width="1.5" opacity="0.3"/>`;
  const goal = `<path d="M14 100 V22 H146 V100" fill="none" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>`;
  const keeper =
    `<g transform="rotate(-28 50 78)"><rect x="26" y="70" width="48" height="16" rx="8" fill="#56b4e9" stroke="${INK}" stroke-width="3.5"/></g>` +
    `<circle cx="54" cy="58" r="9" fill="#56b4e9" stroke="${INK}" stroke-width="3.5"/>`;
  const ball =
    `<circle cx="124" cy="42" r="13" fill="${WHITE}" stroke="${INK}" stroke-width="3.5"/>` +
    `<path d="M124 35 l6 4 -2 7 h-8 l-2 -7 z" fill="${INK}"/>`;
  const grass = `<rect x="0" y="100" width="160" height="12" rx="4" fill="#009e73" stroke="${INK}" stroke-width="3"/>`;
  return (
    grass + net + shadowed(goal, 2, 2) + shadowed(keeper) + shadowed(ball) + sparkle(144, 14, 6)
  );
}
