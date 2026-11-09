// Each game's settings from the admin panel (`game_settings`, Phase 10 step
// 6), read in the browser after a static page loads (owner decision Q2) and
// applied to its markup (GameBadges.astro). A plain REST read with the
// publishable key keeps supabase-js off pages that don't need it.
// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import { supabaseConfig } from "@/lib/supabase/config";

const GameSetting = z.object({
  game_id: z.string(),
  enabled: z.boolean(),
  featured: z.boolean(),
  is_new: z.boolean(),
  hot: z.boolean(),
  beta: z.boolean(),
  position: z.nullable(z.number()),
});
export type GameSetting = z.infer<typeof GameSetting>;
export type GameSettings = ReadonlyMap<string, GameSetting>;

/** The games that have settings, by id; null without Supabase or on failure. */
export async function fetchGameSettings(): Promise<GameSettings | null> {
  if (!supabaseConfig) return null;
  try {
    const response = await fetch(
      `${supabaseConfig.url}/rest/v1/game_settings?select=game_id,enabled,featured,is_new,hot,beta,position`,
      { headers: { apikey: supabaseConfig.key } },
    );
    if (!response.ok) return null;
    const rows = z.array(GameSetting).safeParse(await response.json());
    return rows.success ? new Map(rows.data.map((row) => [row.game_id, row])) : null;
  } catch {
    return null;
  }
}

/** Which badges a game shows. */
export function badgesFor(setting: GameSetting | undefined): Record<string, boolean> {
  return {
    featured: setting?.featured ?? false,
    new: setting?.is_new ?? false,
    hot: setting?.hot ?? false,
    beta: setting?.beta ?? false,
    unavailable: setting ? !setting.enabled : false,
  };
}

/** Sorts games: a place first (smaller first), then featured, then as given. */
export function orderGames<T>(
  items: readonly T[],
  id: (item: T) => string,
  settings: GameSettings,
): T[] {
  const key = (item: T) => {
    const setting = settings.get(id(item));
    return [setting?.position ?? 1000, setting?.featured ? 0 : 1] as const;
  };
  return items
    .map((item, index) => ({ item, index, key: key(item) }))
    .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.index - b.index)
    .map(({ item }) => item);
}

/** Shows badges, orders lists and, on a disabled game's page, says it's off. */
export function applyGameSettings(root: ParentNode, settings: GameSettings): void {
  for (const element of root.querySelectorAll<HTMLElement>("[data-game-id]")) {
    const setting = settings.get(element.dataset.gameId ?? "");
    const badges = badgesFor(setting);
    for (const badge of element.querySelectorAll<HTMLElement>("[data-badge]")) {
      badge.hidden = !badges[badge.dataset.badge ?? ""];
    }
    element.toggleAttribute("data-unavailable", badges.unavailable === true);
  }
  for (const list of root.querySelectorAll<HTMLElement>("[data-game-order]")) {
    const items = [...list.querySelectorAll<HTMLElement>(":scope > [data-game-id]")];
    list.append(...orderGames(items, (item) => item.dataset.gameId ?? "", settings));
  }
  const page = root.querySelector<HTMLElement>("[data-game-page]");
  if (page && settings.get(page.dataset.gamePage ?? "")?.enabled === false) {
    for (const notice of root.querySelectorAll<HTMLElement>("[data-game-unavailable]"))
      notice.hidden = false;
    for (const play of root.querySelectorAll<HTMLElement>("[data-game-play]")) play.hidden = true;
  }
}
