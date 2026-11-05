// Which skins (looks) a player may wear: four free, the rest unlocked by
// level and by Worm Rush's achievements (manifest.ts), cosmetic only (SPEC
// §12.6). The same on the arena server, which puts a locked look back to the
// first, and in the skin picker. How each looks is renderer/skins.ts.
import type { AchievementTier, PlayerProgress } from "@kefche/game-sdk";

export type LookUnlock =
  | { kind: "free" }
  | { kind: "level"; level: number }
  | { kind: "achievement"; achievement: "long-worm" | "regular"; tier: AchievementTier };

const FREE: LookUnlock = { kind: "free" };

/** By look: what unlocks it. */
export const LOOK_UNLOCKS: readonly LookUnlock[] = [
  FREE,
  FREE,
  FREE,
  FREE,
  { kind: "level", level: 5 },
  { kind: "achievement", achievement: "regular", tier: "bronze" },
  { kind: "achievement", achievement: "long-worm", tier: "bronze" },
  { kind: "level", level: 10 },
  { kind: "achievement", achievement: "regular", tier: "silver" },
  { kind: "achievement", achievement: "long-worm", tier: "silver" },
  { kind: "achievement", achievement: "regular", tier: "gold" },
  { kind: "achievement", achievement: "long-worm", tier: "gold" },
];

/** Looks a player may pick (0 to LOOKS − 1): the skins. */
export const LOOKS = LOOK_UNLOCKS.length;

export function lookUnlocked(look: number, progress: PlayerProgress): boolean {
  const unlock = LOOK_UNLOCKS[look];
  switch (unlock?.kind) {
    case undefined:
      return false;
    case "free":
      return true;
    case "level":
      return progress.level >= unlock.level;
    case "achievement":
      return progress.tiers.includes(`${unlock.achievement}.${unlock.tier}`);
  }
}
