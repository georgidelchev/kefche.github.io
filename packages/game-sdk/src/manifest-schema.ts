// Build-time validation of game manifests (SPEC §9.3). Imported by the
// registry while the site builds, never by game code that ships to players.
import { z } from "zod";

import { ENGINE_KINDS, GAME_CATEGORIES, GAME_MODES, type GameManifest } from "./manifest";

const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const difficulty = z.enum(["easy", "medium", "hard"]);

const timerPreset = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({
    kind: z.literal("per-move"),
    seconds: z.int().positive(),
    onExpiry: z.enum(["pass", "random-move", "loss"]),
  }),
  z.object({
    kind: z.literal("clock"),
    base: z.int().positive(),
    increment: z.int().nonnegative(),
  }),
  z.object({ kind: z.literal("countdown"), seconds: z.int().positive() }),
]);

export const gameManifestSchema = z
  .object({
    id: z.string().regex(kebab).max(40),
    version: z.int().positive(),
    category: z.enum(GAME_CATEGORIES),
    kind: z.enum(ENGINE_KINDS),
    players: z.object({ min: z.int().min(1), max: z.int().max(30), default: z.int().min(1) }),
    modes: z.array(z.enum(GAME_MODES)).min(1),
    bots: z.object({
      supported: z.boolean(),
      difficulties: z.array(difficulty),
      canFillSeats: z.boolean(),
    }),
    timers: z.array(timerPreset),
    rated: z.union([
      z.literal(false),
      z.object({ system: z.literal("glicko2"), pools: z.array(z.string().regex(kebab)).min(1) }),
    ]),
    hiddenInformation: z.boolean(),
    orientation: z.enum(["any", "portrait", "landscape"]),
    controls: z.array(z.enum(["tap", "drag", "swipe", "joystick", "keyboard", "mouse"])).min(1),
    renderer: z.enum(["dom", "canvas", "pixi"]),
    physics: z.literal("matter").optional(),
    offline: z.boolean(),
    estimatedMinutes: z.tuple([z.int().positive(), z.int().positive()]),
    contentPacks: z.array(z.string()).optional(),
    leaderboards: z.array(
      z.object({
        id: z.string().regex(kebab),
        metric: z.enum(["score", "time", "rating"]),
        order: z.enum(["asc", "desc"]),
      }),
    ),
    achievements: z.array(z.object({ id: z.string().regex(kebab) })),
    scoreValidation: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("none") }),
      z.object({
        kind: z.literal("plausibility"),
        maxScorePerSecond: z.number().positive().optional(),
        minSeconds: z.number().positive().optional(),
      }),
      z.object({ kind: z.literal("replay") }),
    ]),
    tags: z.array(z.string().regex(kebab)),
  })
  .strict()
  .refine((m) => m.players.min <= m.players.default && m.players.default <= m.players.max, {
    message: "players: expected min ≤ default ≤ max",
    path: ["players"],
  })
  .refine((m) => m.estimatedMinutes[0] <= m.estimatedMinutes[1], {
    message: "estimatedMinutes: expected [shortest, longest]",
    path: ["estimatedMinutes"],
  })
  .refine((m) => !m.bots.supported || m.bots.difficulties.length > 0, {
    message: "bots: list at least one difficulty when bots are supported",
    path: ["bots"],
  });

/** Validates a manifest; throws an error naming the game and every problem. */
export function parseGameManifest(input: unknown, source: string): GameManifest {
  const result = gameManifestSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Invalid game manifest in ${source}:\n${z.prettifyError(result.error)}`);
  }
  return result.data as GameManifest;
}
