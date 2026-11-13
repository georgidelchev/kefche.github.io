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

import { optionsConfig, type GameOptionView, type OptionValues } from "../options";

/** The offline modes the setup screen offers (online matches are set up in a lobby). */
export type TurnMode = Exclude<MatchSetup["mode"], "online">;

/** From the manifest, for games of kind "turn". */
export interface TurnConfig {
  modes: TurnMode[];
  players: { min: number; max: number; default: number };
  difficulties: BotDifficulty[];
  /** A level range players can pick from instead of a difficulty (manifest `bots.levels`). */
  levels?: { min: number; max: number };
  /** The game's options (manifest `options`), picked in the setup or by a room's host. */
  options: GameOptionView[];
  /** The first preset is the default. */
  timers: TimerPreset[];
  /**
   * Indexes into `timers` that an online room may use, the first being its
   * default: all of them, or only the clocks (manifest `awayPlayers`).
   */
  onlineTimers: number[];
}

/** A bot with a `level` plays at that level; its difficulty then only sets its thinking time. */
export type SeatChoice =
  { kind: "human" } | { kind: "bot"; difficulty: BotDifficulty; level?: number };

export interface SetupChoice {
  players: number;
  /** One per seat, `players` long, with at least one person. */
  seats: SeatChoice[];
  /** Index into `TurnConfig.timers`. */
  timer: number;
  /** The game's options, by key. */
  options: OptionValues;
}

const DIFFICULTY = z.enum(["easy", "medium", "hard"]);
const SAVED = z.object({
  players: z.number(),
  seats: z.array(
    z.union([
      z.object({ kind: z.literal("human") }),
      z.object({ kind: z.literal("bot"), difficulty: DIFFICULTY, level: z.optional(z.int()) }),
    ]),
  ),
  timer: z.number(),
  options: z.optional(z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))),
});

const middle = (difficulties: BotDifficulty[]): BotDifficulty =>
  difficulties.includes("medium") ? "medium" : (difficulties[0] ?? "easy");

/** A bot at `level`: its thinking time follows the third of the range the level is in. */
export function levelSeat(level: number, levels: { min: number; max: number }): SeatChoice {
  const share = (level - levels.min) / (levels.max - levels.min);
  const difficulty: BotDifficulty = share < 1 / 3 ? "easy" : share < 2 / 3 ? "medium" : "hard";
  return { kind: "bot", difficulty, level };
}

/**
 * A seat list `players` long: by default seat 0 a person and the rest people
 * (hotseat) or bots. Seats already chosen are kept, as long as someone plays.
 */
export function seatsFor(
  players: number,
  mode: TurnMode,
  config: TurnConfig,
  current: SeatChoice[] = [],
): SeatChoice[] {
  const seats = Array.from({ length: players }, (_, i): SeatChoice => {
    const kept = current[i];
    if (kept) return kept;
    if (i === 0 || mode === "hotseat") return { kind: "human" };
    return { kind: "bot", difficulty: middle(config.difficulties) };
  });
  if (!seats.some((s) => s.kind === "human")) seats[0] = { kind: "human" };
  return seats;
}

/**
 * The fewest seats a mode allows: two, except playing alone against the
 * game itself (no bots) in a game whose manifest allows one player
 * (Hangman, Phase 13). One device needs two people.
 */
export const fewestSeats = (config: TurnConfig, mode: TurnMode): number =>
  mode === "solo-bots" ? Math.max(config.players.min, 1) : Math.max(config.players.min, 2);

export function defaultChoice(config: TurnConfig, mode: TurnMode): SetupChoice {
  const players = Math.max(config.players.default, fewestSeats(config, mode));
  return {
    players,
    seats: seatsFor(players, mode, config),
    timer: 0,
    options: optionsConfig(config.options, {}) ?? {},
  };
}

/** The saved choice if it still fits the game's limits, else the default. */
export function loadChoice(storage: GameStorage, config: TurnConfig, mode: TurnMode): SetupChoice {
  try {
    const parsed = SAVED.safeParse(JSON.parse(storage.get(`setup:${mode}`) ?? "null"));
    if (parsed.success) {
      const { players, timer } = parsed.data;
      const seats = parsed.data.seats.map((seat): SeatChoice => {
        if (seat.kind === "human" || seat.level === undefined) {
          return seat.kind === "human" ? seat : { kind: "bot", difficulty: seat.difficulty };
        }
        return { kind: "bot", difficulty: seat.difficulty, level: seat.level };
      });
      const { levels } = config;
      const levelFits = (level: number | undefined) =>
        level === undefined || (levels !== undefined && level >= levels.min && level <= levels.max);
      const fits =
        players >= fewestSeats(config, mode) &&
        players <= config.players.max &&
        seats.length === players &&
        seats.some((s) => s.kind === "human") &&
        seats.every(
          (s) =>
            s.kind === "human" ||
            (config.difficulties.includes(s.difficulty) && levelFits(s.level)),
        ) &&
        timer >= 0 &&
        timer < config.timers.length;
      // Options the game no longer offers fall back to their default.
      const options = optionsConfig(config.options, parsed.data.options ?? {}) ?? {};
      if (fits) return { players, seats, timer, options };
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
      return {
        kind: "bot",
        difficulty: s.difficulty,
        nameId: botNames[nextBot++] ?? "mila",
        ...(s.level === undefined ? {} : { level: s.level }),
      };
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
    ...configFor(config, choice.options),
  };
}

/** The match's `config`: the options as chosen, for a game that has any. */
export function configFor(config: TurnConfig, values: OptionValues): Pick<MatchSetup, "config"> {
  const chosen = optionsConfig(config.options, values);
  return chosen ? { config: chosen } : {};
}

export type BotNames = Record<BotNameId, string>;
