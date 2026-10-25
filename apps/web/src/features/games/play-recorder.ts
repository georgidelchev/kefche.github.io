// What the player keeps of each game for its record (Phase 7): the play it
// runs on, a single-player game's log, and the play time without pauses.
// The clock is injected, so it can be tested.
import { packActions, type GameResult } from "@kefche/game-sdk";
import type { MatchSetup, PlayLog, TurnRecord } from "@kefche/game-sdk/browser";

import type { Play, PlayRecord } from "./plays";

export interface PlayRecorder {
  /** A new game on `play` (null: it won't be recorded). */
  start(play: Play | null): void;
  /** Where a single-player game logs itself (context.log). */
  log: PlayLog;
  pause(): void;
  resume(): void;
  /** The finished game's record, or null when it isn't recorded. Once per play. */
  finish(
    game: { id: string; version: number },
    result: GameResult,
    turns: TurnRecord | undefined,
    match: MatchSetup | null,
  ): PlayRecord | null;
}

export function createPlayRecorder(now: () => number = () => performance.now()): PlayRecorder {
  let play: Play | null = null;
  let log: { config: unknown; actions: unknown[] } | null = null;
  let startedAt = now();
  let pausedAt: number | null = null;
  let pausedMs = 0;
  const restartClock = () => {
    startedAt = now();
    pausedAt = null;
    pausedMs = 0;
  };

  return {
    start(next) {
      play = next;
      log = null;
      restartClock();
    },
    log: {
      // A game's menu (Sudoku's difficulty, Snake's speed) isn't play time.
      begin(config) {
        log = { config, actions: [] };
        restartClock();
      },
      record(action) {
        log?.actions.push(action);
      },
    },
    pause() {
      pausedAt ??= now();
    },
    resume() {
      if (pausedAt === null) return;
      pausedMs += now() - pausedAt;
      pausedAt = null;
    },
    finish(game, result, turns, match) {
      const current = play;
      play = null;
      if (!current) return null;
      const paused = pausedMs + (pausedAt === null ? 0 : now() - pausedAt);
      const base = {
        playId: current.id,
        gameId: game.id,
        version: game.version,
        result,
        durationMs: Math.max(0, Math.round(now() - startedAt - paused)),
      };
      if (match) {
        // Online matches have their own way (rooms); a match taken over midway can't be replayed.
        if (match.mode === "online" || !turns?.complete) return null;
        return {
          ...base,
          mode: match.mode,
          seats: match.seats.map((seat) => seat.kind),
          moves: turns.moves,
          ...(turns.timedOut === undefined ? {} : { timedOut: turns.timedOut }),
        };
      }
      // A continued game (Sudoku's saved puzzle) wasn't logged from its start.
      if (!log) return null;
      return { ...base, mode: "solo", config: log.config ?? null, log: packActions(log.actions) };
    },
  };
}
