// Aim Trainer sticker art (`pnpm art:generate`): a red and white bullseye
// with a crosshair over it and smaller targets fading behind. Drawn in a
// 160 × 120 box with the shared kit.

const RED = "#e11d48";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const small = [
    [34, 34, 10],
    [128, 92, 8],
  ]
    .map(
      ([x, y, r]) =>
        `<circle cx="${String(x)}" cy="${String(y)}" r="${String(r)}" fill="${RED}" stroke="${INK}" stroke-width="2" opacity="0.55"/>`,
    )
    .join("");
  const rings = [36, 24, 12]
    .map(
      (r, i) =>
        `<circle cx="80" cy="60" r="${String(r)}" fill="${i % 2 === 0 ? RED : WHITE}" stroke="${INK}" stroke-width="${i === 0 ? "4" : "2"}"/>`,
    )
    .join("");
  const cross = `<g stroke="${INK}" stroke-width="4" stroke-linecap="round"><line x1="80" y1="12" x2="80" y2="34"/><line x1="80" y1="86" x2="80" y2="108"/><line x1="32" y1="60" x2="54" y2="60"/><line x1="106" y1="60" x2="128" y2="60"/></g>`;
  return small + shadowed(rings) + cross + sparkle(140, 20) + sparkle(20, 96, 6, WHITE);
}
