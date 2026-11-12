// Sequence Memory sticker art (`pnpm art:generate`): four rounded pads in
// the game's colours with their shapes, one lit and ringed, and a small
// trail of dots for the sequence. Drawn in a 160 × 120 box with the kit.

const PADS = ["#D55E00", "#56B4E9", "#009E73", "#F0E442"];
const SHAPE = "#1d2333";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const s = 40;
  const x0 = 38;
  const y0 = 16;
  const shapes = [
    (cx, cy) => `<circle cx="${String(cx)}" cy="${String(cy)}" r="9" fill="${SHAPE}"/>`,
    (cx, cy) =>
      `<rect x="${String(cx - 8)}" y="${String(cy - 8)}" width="16" height="16" fill="${SHAPE}"/>`,
    (cx, cy) =>
      `<path d="M${String(cx)} ${String(cy - 10)} L${String(cx + 10)} ${String(cy + 8)} H${String(cx - 10)} Z" fill="${SHAPE}"/>`,
    (cx, cy) =>
      `<path d="M${String(cx)} ${String(cy - 11)} L${String(cx + 11)} ${String(cy)} L${String(cx)} ${String(cy + 11)} L${String(cx - 11)} ${String(cy)} Z" fill="${SHAPE}"/>`,
  ];
  let pads = "";
  for (let i = 0; i < 4; i++) {
    const x = x0 + (i % 2) * (s + 6);
    const y = y0 + Math.floor(i / 2) * (s + 6);
    const lit = i === 1;
    pads += `<rect x="${String(x)}" y="${String(y)}" width="${String(s)}" height="${String(s)}" rx="10" fill="${PADS[i]}" stroke="${lit ? WHITE : INK}" stroke-width="4" opacity="${lit ? "1" : "0.8"}"/>`;
    pads += shapes[i](x + s / 2, y + s / 2);
  }
  const trail = [0, 1, 2]
    .map(
      (i) =>
        `<circle cx="${String(140)}" cy="${String(40 + i * 16)}" r="5" fill="${PADS[(i + 1) % 4]}" stroke="${INK}" stroke-width="2"/>`,
    )
    .join("");
  return shadowed(pads) + trail + sparkle(20, 22) + sparkle(22, 100, 6, WHITE);
}
