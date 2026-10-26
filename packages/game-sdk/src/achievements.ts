// Achievements (SPEC §12.6): goals read from a player's stats, in bronze,
// silver and gold. Each game defines its own in its manifest; these are the
// site-wide ones. The server (submit-match) works out which tiers a player
// has reached after each counted game, with `reachedTiers`, and stores the
// new ones. Because they're read from the stats, nothing is missed: a game
// that was counted without the server looking (an online match decided by
// the scheduled job) unlocks with the player's next game.
import type { AchievementDef, AchievementIcon } from "./manifest";

export const ACHIEVEMENT_TIERS = ["bronze", "silver", "gold"] as const;
export type AchievementTier = (typeof ACHIEVEMENT_TIERS)[number];

/** What a site-wide achievement counts: games finished, games tried, the level. */
export type GlobalAchievementMetric = "matches" | "gamesTried" | "level";

export interface GlobalAchievementDef {
  id: string;
  icon: AchievementIcon;
  metric: GlobalAchievementMetric;
  tiers: readonly [number, number, number];
}

/** Site-wide achievements, stored as "global.<id>". Their text is in the site's locales. */
export const GLOBAL_ACHIEVEMENTS = [
  { id: "regular", icon: "gamepad", metric: "matches", tiers: [10, 100, 500] },
  { id: "explorer", icon: "compass", metric: "gamesTried", tiers: [3, 5, 7] },
  { id: "rising-star", icon: "star", metric: "level", tiers: [5, 10, 20] },
] as const satisfies readonly GlobalAchievementDef[];

/** A player's figures in one game, from their stats and ratings. */
export interface GameFigures {
  played: number;
  wins: number;
  bestScore: number | null;
  bestTimeMs: number | null;
  bestStreak: number;
  /** The best rating among the game's pools with 10 or more rated games. */
  rating: number | null;
}

export interface PlayerFigures {
  games: Readonly<Record<string, GameFigures>>;
  matches: number;
  gamesTried: number;
  level: number;
}

/** An unlocked tier: "<game id>.<id>" or "global.<id>". */
export interface AchievementUnlock {
  achievement: string;
  tier: AchievementTier;
}

/** The tiers a figure reaches; time goals are reached at or under, the rest at or over. */
export function tiersFor(
  tiers: readonly [number, number, number],
  value: number | null,
  lowerIsBetter = false,
): AchievementTier[] {
  if (value === null || !Number.isFinite(value)) return [];
  return ACHIEVEMENT_TIERS.filter((_, i) => {
    const goal = tiers[i] ?? Number.NaN;
    return lowerIsBetter ? value <= goal : value >= goal;
  });
}

function gameFigure(def: AchievementDef, figures: GameFigures): number | null {
  switch (def.metric) {
    case "played":
      return figures.played;
    case "wins":
      return figures.wins;
    case "bestScore":
      return figures.bestScore;
    case "bestTime":
      return figures.bestTimeMs;
    case "bestStreak":
      return figures.bestStreak;
    case "rating":
      return figures.rating;
  }
}

/**
 * Every tier the player has reached: the site-wide achievements, and each
 * listed game's own (`definitions`, by game id) for the games they've played.
 */
export function reachedTiers(
  definitions: Readonly<Record<string, readonly AchievementDef[]>>,
  figures: PlayerFigures,
): AchievementUnlock[] {
  const reached: AchievementUnlock[] = [];
  for (const def of GLOBAL_ACHIEVEMENTS) {
    for (const tier of tiersFor(def.tiers, figures[def.metric])) {
      reached.push({ achievement: `global.${def.id}`, tier });
    }
  }
  for (const [gameId, defs] of Object.entries(definitions)) {
    const game = figures.games[gameId];
    if (!game) continue;
    for (const def of defs) {
      for (const tier of tiersFor(def.tiers, gameFigure(def, game), def.metric === "bestTime")) {
        reached.push({ achievement: `${gameId}.${def.id}`, tier });
      }
    }
  }
  return reached;
}
