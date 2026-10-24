// Build-time validation of game manifests (SPEC §9.3). Imported by the
// registry while the site builds, never by game code that ships to players.
import { z } from "zod";

import { ENGINE_KINDS, GAME_CATEGORIES, GAME_MODES, type GameManifest } from "./manifest";

import type { GameText } from "./game-text";

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
      levels: z
        .object({ min: z.int().nonnegative(), max: z.int().positive() })
        .refine((l) => l.min < l.max, { message: "levels: expected min < max" })
        .optional(),
    }),
    timers: z.array(timerPreset),
    awayPlayers: z.enum(["skip", "clock"]).optional(),
    onlineTimer: z.int().nonnegative().optional(),
    raceOptions: z
      .array(
        z.object({
          key: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
          label: z.string().min(1),
          values: z
            .array(
              z.object({
                value: z.union([z.string(), z.number(), z.boolean()]),
                label: z.string(),
              }),
            )
            .min(1),
        }),
      )
      .optional(),
    rated: z.union([
      z.literal(false),
      z.object({
        system: z.literal("glicko2"),
        pools: z
          .array(
            z.object({
              id: z.string().regex(kebab),
              timers: z.array(z.int().nonnegative()).min(1),
            }),
          )
          .min(1),
      }),
    ]),
    hiddenInformation: z.boolean(),
    orientation: z.enum(["any", "portrait", "landscape"]),
    controls: z.array(z.enum(["tap", "drag", "swipe", "joystick", "keyboard", "mouse"])).min(1),
    renderer: z.enum(["dom", "canvas", "pixi"]),
    physics: z.literal("matter").optional(),
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
  .refine(
    (m) =>
      m.onlineTimer === undefined ||
      (m.timers[m.onlineTimer] !== undefined &&
        (m.awayPlayers !== "clock" || m.timers[m.onlineTimer]?.kind === "clock")),
    { message: "onlineTimer: expected a timer that online rooms may use", path: ["onlineTimer"] },
  )
  .refine((m) => m.awayPlayers !== "clock" || m.timers.some((t) => t.kind === "clock"), {
    message: 'awayPlayers: "clock" needs at least one clock timer',
    path: ["awayPlayers"],
  })
  .refine((m) => !m.bots.supported || m.bots.difficulties.length > 0, {
    message: "bots: list at least one difficulty when bots are supported",
    path: ["bots"],
  })
  .refine(
    (m) => {
      if (!m.rated) return true;
      const timers = m.rated.pools.flatMap((p) => p.timers);
      return (
        new Set(timers).size === timers.length &&
        timers.every((i) => m.timers[i]?.kind === "clock") &&
        new Set(m.rated.pools.map((p) => p.id)).size === m.rated.pools.length
      );
    },
    {
      message: "rated: each pool needs its own id and clocks, and a clock is in one pool only",
      path: ["rated"],
    },
  );

const line = z.string().min(1).max(600);

export const gameTextSchema = z
  .object({
    name: z.string().min(1).max(40),
    tagline: z.string().min(1).max(90),
    // CJK descriptions are short in characters, hence the low minimum.
    description: z.string().min(20).max(170),
    about: z.array(line).min(1),
    howToPlay: z.array(line).min(1),
    controls: z.array(line).min(1),
    tips: z.array(line).min(1),
    faq: z.array(z.object({ question: line, answer: line }).strict()).min(1),
    ui: z.record(z.string().regex(/^[a-z][a-zA-Z0-9.]*$/), z.string().min(1)),
  })
  .strict();

/** Validates a game's translations; throws an error naming the file. */
export function parseGameText(input: unknown, source: string): GameText {
  const result = gameTextSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Invalid game text in ${source}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** Validates a manifest; throws an error naming the game and every problem. */
export function parseGameManifest(input: unknown, source: string): GameManifest {
  const result = gameManifestSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Invalid game manifest in ${source}:\n${z.prettifyError(result.error)}`);
  }
  return result.data as GameManifest;
}
