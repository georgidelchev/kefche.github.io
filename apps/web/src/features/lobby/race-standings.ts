// Race mode's rules (Phase 5 step 10), pure so they're easy to check: the
// engine config from the room's options, the host's check of a finished
// player (replaying their moves on the race's seed), and the ranking.
import { replay, unpackActions, type PackedLog, type RaceEngine } from "@kefche/game-sdk";

import type { RaceOptionView } from "@/features/games/page-props";

import type { RaceOptionValues } from "./room-settings";

/** The engine config: every option's chosen value, or its default. Undefined without options. */
export function raceConfig(options: readonly RaceOptionView[], values: RaceOptionValues): unknown {
  if (options.length === 0) return undefined;
  return Object.fromEntries(
    options.map((option) => {
      const chosen = values[option.key];
      const known = option.values.some((v) => v.value === chosen);
      return [option.key, known ? chosen : option.values[0]?.value];
    }),
  );
}

/** A player's game as the replay found it. */
export interface Checked {
  score: number;
  progress: number;
  /** The game itself ended: solved, stuck or out. */
  finished: boolean;
  /** The goal was reached (a solved puzzle, a 2048 tile). */
  completed: boolean;
  /** The log unpacked, replayed and used only moves a race allows. */
  valid: boolean;
}

const INVALID: Checked = { score: 0, progress: 0, finished: true, completed: false, valid: false };

/** The host's check: the player's own moves, replayed from the seed every player shares. */
export function checkRace(
  engine: RaceEngine<unknown, unknown, unknown>,
  config: unknown,
  seed: string,
  log: PackedLog,
): Checked {
  const actions = unpackActions(log);
  if (!actions) return INVALID;
  // Anything in the log may be malformed: the engine reads it inside the try.
  try {
    if (engine.allowedInRace && !actions.every((a) => engine.allowedInRace?.(a) ?? true)) {
      return INVALID;
    }
    const state = replay(engine, config, seed, actions);
    const result = engine.result(state);
    return {
      score: engine.score?.(state) ?? result?.score ?? 0,
      progress: engine.progress(state),
      finished: result !== null,
      completed: result?.completed ?? false,
      valid: true,
    };
  } catch {
    // Moves the engine can't even read.
    return INVALID;
  }
}

export interface Standing {
  member: string;
  name: string;
  score: number;
  progress: number;
  finished: boolean;
  completed: boolean;
  /** From the race's start to the finish, once the host checked it. */
  timeMs: number | null;
  /** Null until the host checked it. */
  valid: boolean | null;
}

/**
 * Best first. "time" (Sudoku): solved puzzles by time, then the rest by
 * progress. "score": by score, then progress. Results that failed the check
 * come last.
 */
export function rank(rows: readonly Standing[], ranking: "score" | "time"): Standing[] {
  const time = (r: Standing) => r.timeMs ?? Number.POSITIVE_INFINITY;
  return [...rows].sort((a, b) => {
    if ((a.valid === false) !== (b.valid === false)) return a.valid === false ? 1 : -1;
    if (ranking === "time") {
      if (a.completed !== b.completed) return a.completed ? -1 : 1;
      if (a.completed) return time(a) - time(b);
      return b.progress - a.progress;
    }
    return b.score - a.score || b.progress - a.progress || time(a) - time(b);
  });
}
