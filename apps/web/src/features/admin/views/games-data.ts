// The Games section's data (Phase 10 step 6): each game's settings
// (game_settings, changed through staff_set_game), its numbers
// (staff_game_stats), the open rooms (staff_live_rooms, closed through
// staff_close_room) and the arena server's open arenas (its /status).
// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import type { Supabase } from "@/lib/supabase/client";

const Setting = z.object({
  game_id: z.string(),
  enabled: z.boolean(),
  featured: z.boolean(),
  is_new: z.boolean(),
  hot: z.boolean(),
  beta: z.boolean(),
  position: z.nullable(z.number()),
});
export type Setting = z.infer<typeof Setting>;

/** A game without a row: enabled, no badges, the catalog's order. */
export const defaultSetting = (gameId: string): Setting => ({
  game_id: gameId,
  enabled: true,
  featured: false,
  is_new: false,
  hot: false,
  beta: false,
  position: null,
});

const count = z.number();
const Stats = z.object({
  game_id: z.string(),
  matches_day: count,
  matches_week: count,
  matches_all: count,
  players_week: count,
  in_review: count,
  open_rooms: count,
});
export type Stats = z.infer<typeof Stats>;

export interface GamesData {
  settings: Map<string, Setting>;
  stats: Map<string, Stats>;
}

/** Every game's settings and numbers; null on failure. */
export async function fetchGames(supabase: Supabase): Promise<GamesData | null> {
  const [settings, stats] = await Promise.all([
    supabase
      .from("game_settings")
      .select("game_id, enabled, featured, is_new, hot, beta, position"),
    supabase.rpc("staff_game_stats"),
  ]);
  if (settings.error || stats.error) return null;
  const s = z.array(Setting).safeParse(settings.data);
  const n = z.array(Stats).safeParse(stats.data);
  if (!s.success || !n.success) return null;
  return {
    settings: new Map(s.data.map((row) => [row.game_id, row])),
    stats: new Map(n.data.map((row) => [row.game_id, row])),
  };
}

/** Saves a game's settings (audited); null when done, else the error code. */
export async function saveGame(supabase: Supabase, setting: Setting): Promise<string | null> {
  const { error } = await supabase.rpc("staff_set_game", {
    p_game: setting.game_id,
    p_enabled: setting.enabled,
    p_featured: setting.featured,
    p_new: setting.is_new,
    p_hot: setting.hot,
    p_beta: setting.beta,
    ...(setting.position === null ? {} : { p_position: setting.position }),
  });
  return error ? error.message : null;
}

const LiveRoom = z.object({
  id: z.string(),
  code: z.string(),
  game_id: z.string(),
  status: z.string(),
  visibility: z.string(),
  rated: z.boolean(),
  seats: z.number(),
  players: count,
  spectators: count,
  host_id: z.nullable(z.string()),
  host_nickname: z.nullable(z.string()),
  created_at: z.string(),
  last_active_at: z.string(),
});
export type LiveRoom = z.infer<typeof LiveRoom>;

/** The open rooms, newest first (of one game when given); null on failure. */
export async function fetchRooms(
  supabase: Supabase,
  game: string | null,
): Promise<LiveRoom[] | null> {
  const { data, error } = await supabase.rpc("staff_live_rooms", game ? { p_game: game } : {});
  if (error) return null;
  const rooms = z.array(LiveRoom).safeParse(data);
  return rooms.success ? rooms.data : null;
}

/** Closes a room (audited); null when done, else the error code. */
export async function closeRoom(supabase: Supabase, room: LiveRoom): Promise<string | null> {
  const { error } = await supabase.rpc("staff_close_room", { p_room: room.id });
  return error ? error.message : null;
}

const ArenaStatus = z.object({
  games: z.record(z.string(), z.object({ arenas: z.number(), people: z.number() })),
});
export type ArenaStatus = z.infer<typeof ArenaStatus>["games"];

/** Open arenas per game from the arena server; null without one or on failure. */
export async function fetchArenas(arenaUrl: string | null): Promise<ArenaStatus | null> {
  if (arenaUrl === null) return null;
  try {
    const response = await fetch(`${arenaUrl}/status`);
    if (!response.ok) return null;
    const status = ArenaStatus.safeParse(await response.json());
    return status.success ? status.data.games : null;
  } catch {
    return null;
  }
}

/** The room filter in the URL (`?game=`), when it's a known game. */
export function gameFromUrl(search: string, games: readonly string[]): string | null {
  const game = new URLSearchParams(search).get("game");
  return game !== null && games.includes(game) ? game : null;
}
