// Online arena lives (Phase 9): what the arena server reports when lives end,
// and the boards a life goes on. The arena server ran the game, so its word
// is the result; only it holds ARENA_SECRET.
import * as z from "zod";

import { boardEntries, type BoardEntry } from "./leaderboards.ts";

import type { LeaderboardDef } from "./engines.ts";

export const arenaLifeSchema = z.object({
  /** The arena server's key for the life: the same in a retried report. */
  life: z.string().min(1).max(120),
  userId: z.uuid(),
  /** The arena it was played in. */
  arena: z.string().min(1).max(64),
  /** The life's longest length (the game's score). */
  score: z.number().int().nonnegative().max(10_000_000),
  kills: z.number().int().nonnegative().max(10_000),
  durationMs: z
    .number()
    .int()
    .nonnegative()
    .max(24 * 3_600_000),
  /** Knocked out by a worm, by the edge, or left the arena while in play. */
  end: z.enum(["knockout", "edge", "left"]),
});
export type ArenaLife = z.infer<typeof arenaLifeSchema>;

export const arenaReportSchema = z.object({
  arena: z.object({
    gameId: z
      .string()
      .max(40)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    version: z.number().int().positive(),
    lives: z.array(arenaLifeSchema).min(1).max(50),
  }),
});

/** The boards an arena life goes on: the game's score boards, with its longest length. */
export const arenaBoardEntries = (
  gameId: string,
  boards: readonly LeaderboardDef[],
  life: ArenaLife,
): BoardEntry[] =>
  boardEntries(gameId, boards, {
    config: null,
    score: life.score,
    timeMs: null,
    completed: false,
    assisted: false,
  });
