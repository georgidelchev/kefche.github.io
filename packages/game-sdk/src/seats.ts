// Seats in a turn-based match (SPEC §9.5, §10.3): each seat is a person or a
// bot. A seat's number also picks its colour (`--player-<n>` tokens, a
// colour-blind-safe palette) and its shape, so colour is never the only cue.

import type { BotDifficulty } from "./manifest";
import type { Rng } from "./prng";

/**
 * One per `--player-<n>` colour token, in the same order, matching
 * `PlayerMarker` in `@kefche/ui`.
 */
export const PLAYER_SHAPES = [
  "circle",
  "square",
  "triangle",
  "diamond",
  "star",
  "hexagon",
  "cross",
  "heart",
] as const;
export type PlayerShape = (typeof PLAYER_SHAPES)[number];

export const MAX_SEATS = PLAYER_SHAPES.length;

export const seatShape = (seat: number): PlayerShape => PLAYER_SHAPES[seat % MAX_SEATS] ?? "circle";

/**
 * Bot names, translated by the app (each locale spells them in its own
 * script). Short names that read well in every language.
 */
export const BOT_NAME_IDS = [
  "mila",
  "teo",
  "ana",
  "niko",
  "lea",
  "omar",
  "yuki",
  "ravi",
  "sara",
  "ivo",
  "zara",
  "leo",
] as const;
export type BotNameId = (typeof BOT_NAME_IDS)[number];

export type Seat =
  { kind: "human"; name: string } | { kind: "bot"; difficulty: BotDifficulty; nameId: BotNameId };

/** Different names for `count` bots, from the match's seed. */
export function pickBotNames(rng: Rng, count: number): BotNameId[] {
  return rng.shuffle(BOT_NAME_IDS).slice(0, count);
}
