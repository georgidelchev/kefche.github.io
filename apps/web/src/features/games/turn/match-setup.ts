// Setup for turn-based games (Phase 4): what the setup screen offers, the
// choice it remembers per game and mode, and turning a choice into the
// `MatchSetup` the game receives. Runs in the browser (zod/mini).
import { z } from "zod/mini";

import {
  Rng,
  pickBotNames,
  type BotDifficulty,
  type BotNameId,
  type Seat,
  type TimerPreset,
} from "@kefche/game-sdk";
import type { GameStorage, MatchSetup } from "@kefche/game-sdk/browser";

export type TurnMode = MatchSetup["mode"];

/** From the manifest, for games of kind "turn". */
export interface TurnConfig {
  modes: TurnMode[];
  players: { min: number; max: number; default: number };
  difficulties: BotDifficulty[];
  /** The first preset is the default. */
  timers: TimerPreset[];
}

export type SeatChoice = { kind: "human" } | { kind: "bot"; difficulty: BotDifficulty };

export interface SetupChoice {
  players: number;
  /** One per seat, `players` long. Seat 0 is always a person. */
  seats: SeatChoice[];
  /** Index into `TurnConfig.timers`. */
  timer: number;
}

const DIFFICULTY = z.enum(["easy", "medium", "hard"]);
const SAVED = z.object({
  players: z.number(),
  seats: z.array(
    z.union([
      z.object({ kind: z.literal("human") }),
      z.object({ kind: z.literal("bot"), difficulty: DIFFICULTY }),
    ]),
  ),
  timer: z.number(),
});

const middle = (difficulties: BotDifficulty[]): BotDifficulty =>
  difficulties.includes("medium") ? "medium" : (difficulties[0] ?? "easy");

/** A seat list `players` long: seat 0 a person, the rest people (hotseat) or bots. */
export function seatsFor(
  players: number,
  mode: TurnMode,
  config: TurnConfig,
  current: SeatChoice[] = [],
): SeatChoice[] {
  return Array.from({ length: players }, (_, i): SeatChoice => {
    if (i === 0) return { kind: "human" };
    return (
      current[i] ??
      (mode === "hotseat"
        ? { kind: "human" }
        : { kind: "bot", difficulty: middle(config.difficulties) })
    );
  });
}

export function defaultChoice(config: TurnConfig, mode: TurnMode): SetupChoice {
  const players = Math.max(config.players.default, 2);
  return { players, seats: seatsFor(players, mode, config), timer: 0 };
}

/** The saved choice if it still fits the game's limits, else the default. */
export function loadChoice(storage: GameStorage, config: TurnConfig, mode: TurnMode): SetupChoice {
  try {
    const parsed = SAVED.safeParse(JSON.parse(storage.get(`setup:${mode}`) ?? "null"));
    if (parsed.success) {
      const { players, seats, timer } = parsed.data;
      const fits =
        players >= Math.max(config.players.min, 2) &&
        players <= config.players.max &&
        seats.length === players &&
        seats[0]?.kind === "human" &&
        seats.every((s) => s.kind === "human" || config.difficulties.includes(s.difficulty)) &&
        timer >= 0 &&
        timer < config.timers.length;
      if (fits) return { players, seats, timer };
    }
  } catch {
    // Not valid JSON: fall back to the default.
  }
  return defaultChoice(config, mode);
}

export function saveChoice(storage: GameStorage, mode: TurnMode, choice: SetupChoice): void {
  storage.set(`setup:${mode}`, JSON.stringify(choice));
}

/** Labels for seats, from the page's strings. */
export interface SeatNames {
  you: string;
  /** "Player {n}" */
  player: string;
  bots: BotNames;
}

export function toMatch(
  choice: SetupChoice,
  config: TurnConfig,
  names: SeatNames,
  seed: string,
  locale: string,
): MatchSetup {
  const bots = choice.seats.filter((s) => s.kind === "bot").length;
  const botNames = pickBotNames(Rng.fromSeed(`${seed}:names`), bots);
  const humans = choice.seats.filter((s) => s.kind === "human").length;
  let nextBot = 0;
  const seats = choice.seats.map((s, i): Seat => {
    if (s.kind === "bot") {
      return { kind: "bot", difficulty: s.difficulty, nameId: botNames[nextBot++] ?? "mila" };
    }
    return {
      kind: "human",
      name: humans === 1 ? names.you : names.player.replace("{n}", (i + 1).toLocaleString(locale)),
    };
  });
  return {
    mode: humans === 1 ? "solo-bots" : "hotseat",
    seats,
    names: seats.map((seat) => (seat.kind === "bot" ? names.bots[seat.nameId] : seat.name)),
    timer: config.timers[choice.timer] ?? { kind: "none" },
  };
}

export type BotNames = Record<BotNameId, string>;
