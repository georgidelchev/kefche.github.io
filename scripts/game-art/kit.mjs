// The "chunky stickers" art kit (owner's pick, Phase 3): helpers each game's
// assets/art.mjs uses to draw its emblem in a 160 × 120 box. Everything is
// plain SVG with no <text>, so the files render the same as <img> anywhere.

export const INK = "#141826";
export const WHITE = "#ffffff";

/**
 * Draws `shape` with a hard ink shadow offset by (dx, dy): the same shape
 * with every fill turned to ink, underneath.
 */
export function shadowed(shape, dx = 4, dy = 4) {
  const shadow = shape.replaceAll(/fill="(?!none)[^"]+"/g, `fill="${INK}"`);
  return `<g transform="translate(${dx} ${dy})">${shadow}</g>${shape}`;
}

/** A four-pointed sparkle centred on (x, y). */
export function sparkle(x, y, r = 7, fill = WHITE) {
  const k = r * 0.28;
  return (
    `<path d="M${x} ${y - r}L${x + k} ${y - k}L${x + r} ${y}L${x + k} ${y + k}L${x} ${y + r}` +
    `L${x - k} ${y + k}L${x - r} ${y}L${x - k} ${y - k}Z" fill="${fill}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`
  );
}

// Hand-drawn digits as open strokes on a 10 × 16 grid.
const GLYPHS = {
  0: "M5 0C9 0 10 4 10 8S9 16 5 16 0 12 0 8 1 0 5 0Z",
  1: "M2 3.5L6 0V16",
  2: "M0.5 3.5C1 1 3 0 5 0C8 0 10 1.8 10 4.5C10 7.5 7 9.5 0 16H10",
  3: "M0.5 1.5C2 0.4 3.4 0 5 0C8 0 9.6 1.6 9.6 4S7.6 7.6 4.5 7.6C8 7.6 10 9.2 10 11.8S8 16 5 16C3 16 1.4 15.4 0 14",
  4: "M7.5 16V0L0 11H10",
  5: "M9.5 0H1.5L0.8 7C2 6.4 3.4 6 5 6C8 6 10 7.8 10 10.8S8 16 5 16C3 16 1.4 15.4 0 14",
  6: "M8.5 0.6C3.5 0.6 0 4 0 10C0 14 2 16 5 16S10 14 10 11 8 6 5 6 0 8 0 10",
  7: "M0 0H10C6 5 4 10 3.5 16",
  8: "M5 0C8 0 9.5 1.6 9.5 3.9S7.7 7.4 5 7.6C2.3 7.4 0.5 6.2 0.5 3.9S2 0 5 0ZM5 7.6C8.2 7.8 10 9.4 10 11.8S8 16 5 16 0 14.4 0 11.8 1.8 7.8 5 7.6Z",
  9: "M10 6C10 2.5 8 0 5 0S0 2.4 0 5.4 2 10.4 5 10.4 10 8.4 10 6C10 11 8.5 16 3 16",
};

/**
 * A number in hand-drawn strokes, centred on (cx, cy), `height` tall.
 * `weight` is the stroke width in the drawing's own units.
 */
export function digits(value, cx, cy, height, color = INK, weight = 3) {
  const chars = [...String(value)];
  const s = height / 16;
  const width = (chars.length * 10 + (chars.length - 1) * 4) * s;
  return chars
    .map((d, i) => {
      const glyph = GLYPHS[d];
      if (!glyph) throw new Error(`No glyph for "${d}"`);
      const x = cx - width / 2 + i * 14 * s;
      return (
        `<path d="${glyph}" transform="translate(${round(x)} ${round(cy - height / 2)}) scale(${round(s)})" fill="none" ` +
        `stroke="${color}" stroke-width="${round(weight / s)}" stroke-linecap="round" stroke-linejoin="round"/>`
      );
    })
    .join("");
}

const round = (n) => Math.round(n * 1000) / 1000;
