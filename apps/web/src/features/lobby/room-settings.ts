// The game part of a room's settings (rooms.settings, jsonb), as the lobby
// reads and writes it. It comes from the database, so it is parsed, with
// defaults for anything missing or malformed.
import * as z from "zod/mini";

import type { BotDifficulty } from "@kefche/game-sdk";

/** A race option's chosen value, by option key (manifest `raceOptions`). */
export type RaceOptionValues = Record<string, string | number | boolean>;

export interface RoomSettings {
  /** Index into the manifest's timer presets (a race's time limit). */
  timer: number;
  /** Bot difficulty per bot seat ("2": "hard"). */
  bots: Record<string, BotDifficulty>;
  /** Race mode: the game's options. */
  options: RaceOptionValues;
  /** Set by start_room for each match; every member builds the match from it. */
  seed: string | null;
  /** When start_room started the match, ms since epoch (the database's clock). */
  startedAt: number | null;
}

const schema = z.object({
  timer: z.optional(z.int().check(z.nonnegative())),
  bots: z.optional(z.record(z.string(), z.enum(["easy", "medium", "hard"]))),
  options: z.optional(z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))),
  seed: z.optional(z.string()),
  startedAt: z.optional(z.number()),
});

export function parseRoomSettings(raw: unknown): RoomSettings {
  const parsed = schema.safeParse(raw);
  const data = parsed.success ? parsed.data : {};
  return {
    timer: data.timer ?? 0,
    bots: data.bots ?? {},
    options: data.options ?? {},
    seed: data.seed ?? null,
    startedAt: data.startedAt ?? null,
  };
}

/** What the lobby writes back: the seed and start time are the database's to set. */
export const settingsJson = ({
  timer,
  bots,
  options,
}: Pick<RoomSettings, "timer" | "bots"> & {
  options?: RaceOptionValues;
}) => ({ timer, bots, options: options ?? {} });

/**
 * A rated room's pool and clock (rooms.rated), or null. Rated matchmaking's
 * rooms play one game; a rated lobby (`lobby`) stays one, with rematches.
 */
export interface RatedRoom {
  pool: string;
  clock: { base: number; increment: number };
  lobby: boolean;
}

const ratedSchema = z.object({
  pool: z.string(),
  clock: z.object({ base: z.number(), increment: z.number() }),
  lobby: z.optional(z.boolean()),
});

export function parseRated(raw: unknown): RatedRoom | null {
  const parsed = ratedSchema.safeParse(raw);
  return parsed.success ? { ...parsed.data, lobby: parsed.data.lobby ?? false } : null;
}
