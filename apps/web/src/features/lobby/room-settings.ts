// The game part of a room's settings (rooms.settings, jsonb), as the lobby
// reads and writes it. It comes from the database, so it is parsed, with
// defaults for anything missing or malformed.
import * as z from "zod/mini";

import type { BotDifficulty } from "@kefche/game-sdk";

export interface RoomSettings {
  /** Index into the manifest's timer presets. */
  timer: number;
  /** Bot difficulty per bot seat ("2": "hard"). */
  bots: Record<string, BotDifficulty>;
  /** Set by start_room for each match; every member builds the match from it. */
  seed: string | null;
}

const schema = z.object({
  timer: z.optional(z.int().check(z.nonnegative())),
  bots: z.optional(z.record(z.string(), z.enum(["easy", "medium", "hard"]))),
  seed: z.optional(z.string()),
});

export function parseRoomSettings(raw: unknown): RoomSettings {
  const parsed = schema.safeParse(raw);
  const data = parsed.success ? parsed.data : {};
  return { timer: data.timer ?? 0, bots: data.bots ?? {}, seed: data.seed ?? null };
}

/** What the lobby writes back: the seed is the database's to set. */
export const settingsJson = ({ timer, bots }: RoomSettings) => ({ timer, bots });
