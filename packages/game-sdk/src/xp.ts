// Levels from XP (SPEC §12.6). Level n takes 100 × n XP to leave, so
// reaching level L takes 50 × L × (L − 1) XP in all:
//
//   level   2    3    4     5     10     20      50
//   XP    100  300  600  1,000  4,500  19,000  122,500
//
// The server awards XP (private.count_result) and keeps profiles.level with
// the same curve (private.level_for_xp); the Deno tests check this one.

/** The XP it takes to leave level 1; each level after takes this much more. */
export const LEVEL_STEP_XP = 100;

/** A whole number of at least `min`; anything else (NaN, Infinity) is `min`. */
const whole = (n: number, min: number) => (Number.isFinite(n) ? Math.max(min, Math.floor(n)) : min);

/** The total XP at which `level` starts (level 1 at 0). */
export function xpForLevel(level: number): number {
  const l = whole(level, 1);
  return (LEVEL_STEP_XP / 2) * l * (l - 1);
}

/** The level a total of `xp` reaches. */
export function levelForXp(xp: number): number {
  const total = whole(xp, 0);
  // The inverse of xpForLevel, then exact in whole numbers.
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * total) / LEVEL_STEP_XP)) / 2));
  while (xpForLevel(level + 1) <= total) level += 1;
  while (level > 1 && xpForLevel(level) > total) level -= 1;
  return level;
}

export interface LevelProgress {
  level: number;
  /** XP gained since this level started. */
  into: number;
  /** XP this level takes in all, from its start to the next. */
  span: number;
  /** 0 to 1 of the way to the next level. */
  fraction: number;
}

/** Where a total of `xp` stands within its level, for a level bar. */
export function levelProgress(xp: number): LevelProgress {
  const total = whole(xp, 0);
  const level = levelForXp(total);
  const into = total - xpForLevel(level);
  const span = xpForLevel(level + 1) - xpForLevel(level);
  return { level, into, span, fraction: into / span };
}
