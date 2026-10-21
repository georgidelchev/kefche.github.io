/** Number of entries in the player palette (tokens.css `--player-1..8`). */
export const PALETTE_SIZE = 8;

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * First 1–2 letters or digits of a nickname, uppercased (SPEC §7.2). Works on
 * graphemes, so accented, Cyrillic, CJK and emoji-adjacent names are safe.
 */
export function initialsFor(name: string, locale?: string): string {
  const graphemes: string[] = [];
  for (const { segment } of segmenter.segment(name)) {
    if (LETTER_OR_DIGIT.test(segment)) graphemes.push(segment);
    if (graphemes.length === 2) break;
  }
  return graphemes.join("").toLocaleUpperCase(locale);
}

/** Stable palette slot 1–8 derived from a user id (FNV-1a hash). */
export function paletteIndexFor(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ((hash >>> 0) % PALETTE_SIZE) + 1;
}
