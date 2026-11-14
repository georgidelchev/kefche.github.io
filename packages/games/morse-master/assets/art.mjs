// Morse Master sticker art (`pnpm art:generate`): a straight telegraph key
// on its wooden base, its knob pressed, with a line of dots and dashes
// flying off above it and sound waves at the side. No text, so the art
// renders the same everywhere.

const WOOD = "#b45309";
const BRASS = "#f59e0b";
const KNOB = "#1e293b";
const SIGNAL = "#38bdf8";

/** @param {typeof import("../../../../scripts/game-art/kit.mjs")} kit */
export function emblem({ INK, WHITE, shadowed, sparkle }) {
  const base = `<rect x="22" y="84" width="104" height="20" rx="6" fill="${WOOD}" stroke="${INK}" stroke-width="4"/>`;
  const post = `<rect x="34" y="70" width="16" height="16" rx="3" fill="${BRASS}" stroke="${INK}" stroke-width="3"/>`;
  const lever = `<path d="M40 72 L112 64 L112 72 L40 80 Z" fill="${BRASS}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  const contact = `<rect x="98" y="76" width="12" height="8" rx="2" fill="${BRASS}" stroke="${INK}" stroke-width="2.5"/>`;
  const knob = `<ellipse cx="114" cy="60" rx="15" ry="9" fill="${KNOB}" stroke="${INK}" stroke-width="3.5"/>`;
  // Dots and dashes: · − · · −
  const marks = [
    [20, 0],
    [36, 1],
    [66, 0],
    [82, 0],
    [98, 1],
  ]
    .map(([x, dash]) =>
      dash
        ? `<rect x="${String(x)}" y="26" width="24" height="10" rx="5" fill="${WHITE}" stroke="${INK}" stroke-width="3"/>`
        : `<circle cx="${String(x + 5)}" cy="31" r="5.5" fill="${WHITE}" stroke="${INK}" stroke-width="3"/>`,
    )
    .join("");
  const waves = [0, 1]
    .map(
      (i) =>
        `<path d="M${String(136 + i * 9)} ${String(46 - i * 6)} q${String(7 + i * 2)} ${String(14 + i * 6)} 0 ${String(28 + i * 12)}" fill="none" stroke="${SIGNAL}" stroke-width="5" stroke-linecap="round"/>`,
    )
    .join("");
  return (
    shadowed(base) + post + lever + contact + knob + marks + waves + sparkle(140, 18, 6, WHITE)
  );
}
