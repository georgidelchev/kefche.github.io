// The leaderboards there are (SPEC §12.4), with their names in the page's
// language: each game's own boards (its manifest), a board per rated pool,
// and the XP board. Server side only (pages and props).
import type { RegisteredGame } from "@/features/games/registry";
import { poolName } from "@/features/profile/history-text";
import type { AppT } from "@/i18n/i18n";
import type { Locale } from "@/i18n/locales";

export interface BoardOption {
  /** "<game>.<board>", "<game>.rating-<pool>" or "xp" (the leaderboard RPC's p_board). */
  id: string;
  name: string;
  /** How its values read: points, a time, a rating or XP. */
  kind: "score" | "time" | "rating" | "xp";
  /** Rated boards are ratings as they are now: no week of their own. */
  weekly: boolean;
}

export interface BoardGroup {
  /** The game's name, or null for the site-wide boards. */
  label: string | null;
  boards: BoardOption[];
}

/** A game's boards: its manifest's, then one per rated pool. */
export function gameBoards(game: RegisteredGame, t: AppT, locale: Locale): BoardOption[] {
  const { manifest } = game;
  const text = game.text[locale];
  return [
    ...manifest.leaderboards.map((board) => ({
      id: `${manifest.id}.${board.id}`,
      name: text.leaderboards[board.id] ?? board.id,
      kind: board.metric,
      weekly: true,
    })),
    ...(manifest.rated
      ? manifest.rated.pools.map((pool) => ({
          id: `${manifest.id}.rating-${pool.id}`,
          name: poolName(t, pool.id),
          kind: "rating" as const,
          weekly: false,
        }))
      : []),
  ];
}

/**
 * Every board: the XP board, then each game's, by game. A game's boards are
 * named with the game too ("Snake · Best score"), as a closed picker shows
 * only the board.
 */
export function allBoards(games: readonly RegisteredGame[], t: AppT, locale: Locale): BoardGroup[] {
  return [
    { label: null, boards: [{ id: "xp", name: t("leaderboards:xp"), kind: "xp", weekly: true }] },
    ...games
      .map((game) => {
        const label = game.text[locale].name;
        return {
          label,
          boards: gameBoards(game, t, locale).map((b) => ({ ...b, name: `${label} · ${b.name}` })),
        };
      })
      .filter((group) => group.boards.length > 0),
  ];
}
