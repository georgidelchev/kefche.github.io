// A player's achievements as their profile shows them (SPEC §12.6): the best
// tier of each, with its name and the description of that tier's goal, in
// the page's language. Definitions come from the games' manifests and the
// SDK; each game's text from its i18n files (only the "achievements" key, so
// the rest of every game's text stays out of the Worker).
import { IntlMessageFormat } from "intl-messageformat";

import {
  ACHIEVEMENT_TIERS,
  GLOBAL_ACHIEVEMENTS,
  type AchievementDef,
  type AchievementIcon,
  type AchievementTier,
} from "@kefche/game-sdk";

import { gameName } from "@/features/games/game-names";
import type { AppT } from "@/i18n/i18n";
import type { Locale } from "@/i18n/locales";

import { durationText } from "./history-text";

import type { AchievementUnlockRow } from "./history";

const manifests = import.meta.glob<{ achievements: AchievementDef[] }>(
  "../../../../../packages/games/*/manifest.ts",
  { eager: true, import: "manifest" },
);
const texts = import.meta.glob<Record<string, { name: string; description: string }>>(
  "../../../../../packages/games/*/i18n/*.json",
  { eager: true, import: "achievements" },
);

const gameDefs = new Map(
  Object.entries(manifests).map(([path, manifest]) => [
    /\/packages\/games\/([^/]+)\/manifest\.ts$/.exec(path)?.[1] ?? "",
    manifest.achievements,
  ]),
);

/** A site-wide achievement's name, and its description at `goal` (literal keys, for i18n:check). */
function globalText(t: AppT, id: string, goal: number) {
  switch (id) {
    case "regular":
      return {
        name: t("profile:achievements.regular.name"),
        description: t("profile:achievements.regular.description", { count: goal }),
      };
    case "explorer":
      return {
        name: t("profile:achievements.explorer.name"),
        description: t("profile:achievements.explorer.description", { count: goal }),
      };
    case "rising-star":
      return {
        name: t("profile:achievements.risingStar.name"),
        description: t("profile:achievements.risingStar.description", { count: goal }),
      };
    default:
      return null;
  }
}

/** A game's achievement name, and its ICU description at `goal` ({count}, or {time}). */
function gameText(game: string, id: string, locale: Locale, bcp47: string, goal: number) {
  const text = texts[`../../../../../packages/games/${game}/i18n/${locale}.json`]?.[id];
  if (!text) return null;
  const description = new IntlMessageFormat(text.description, bcp47).format({
    count: goal,
    time: durationText(goal),
  });
  return { name: text.name, description: String(description) };
}

/** Every achievement's name in this locale, by "<game id>.<id>" or "global.<id>" (notifications name them). */
export function achievementNames(t: AppT, locale: Locale): Record<string, string> {
  const names: Record<string, string> = {};
  for (const def of GLOBAL_ACHIEVEMENTS) {
    const text = globalText(t, def.id, 0);
    if (text) names[`global.${def.id}`] = text.name;
  }
  for (const [game, defs] of gameDefs) {
    const text = texts[`../../../../../packages/games/${game}/i18n/${locale}.json`];
    for (const def of defs) {
      const name = text?.[def.id]?.name;
      if (name) names[`${game}.${def.id}`] = name;
    }
  }
  return names;
}

export interface ShownAchievement {
  /** "<game id>.<id>" or "global.<id>". */
  key: string;
  icon: AchievementIcon;
  tier: AchievementTier;
  tierName: string;
  /** The game's name, or null for a site-wide achievement. */
  game: string | null;
  name: string;
  /** What this tier took ("Win 25 games"). */
  description: string;
  /** Its place in the showcase (1–3), or null. */
  pinned: number | null;
  unlockedAt: string;
}

const rank = (tier: AchievementTier) => ACHIEVEMENT_TIERS.indexOf(tier);

/**
 * The best tier of each unlocked achievement, best tiers and latest first.
 * Achievements the site no longer defines are left out.
 */
export function shownAchievements(
  unlocks: readonly AchievementUnlockRow[],
  t: AppT,
  locale: Locale,
  bcp47: string,
): ShownAchievement[] {
  const tierNames = {
    bronze: t("profile:tier.bronze"),
    silver: t("profile:tier.silver"),
    gold: t("profile:tier.gold"),
  };
  const best = new Map<string, AchievementUnlockRow & { pinnedAny: number | null }>();
  for (const unlock of unlocks) {
    const known = best.get(unlock.achievement);
    const pinnedAny = unlock.pinned ?? known?.pinnedAny ?? null;
    if (!known || rank(unlock.tier) > rank(known.tier))
      best.set(unlock.achievement, { ...unlock, pinnedAny });
    else known.pinnedAny = pinnedAny;
  }
  const shown: ShownAchievement[] = [];
  for (const [key, unlock] of best) {
    const [scope = "", id = ""] = key.split(".");
    const def =
      scope === "global"
        ? GLOBAL_ACHIEVEMENTS.find((d) => d.id === id)
        : gameDefs.get(scope)?.find((d) => d.id === id);
    if (!def) continue;
    const goal = def.tiers[rank(unlock.tier)] ?? 0;
    const text =
      scope === "global" ? globalText(t, id, goal) : gameText(scope, id, locale, bcp47, goal);
    if (!text) continue;
    shown.push({
      key,
      icon: def.icon,
      tier: unlock.tier,
      tierName: tierNames[unlock.tier],
      game: scope === "global" ? null : gameName(scope, locale),
      name: text.name,
      description: text.description,
      pinned: unlock.pinnedAny,
      unlockedAt: unlock.unlockedAt,
    });
  }
  return shown.sort(
    (a, b) => rank(b.tier) - rank(a.tier) || b.unlockedAt.localeCompare(a.unlockedAt),
  );
}
