// Plays (Phase 7, SPEC §12.5): each game an account plays outside a room
// runs on a seed the server issued (`start_play`), and its record goes to
// `submit-match`, which replays it. A play takes one result, so a finished
// game can't be sent twice.
//
// Guests' games stay on their device (owner decision 2026-10-25), so nothing
// is asked for them and supabase-js isn't loaded. The player keeps the next
// play ready, asked for in the background, so a game never waits for the
// network. A game started without one isn't recorded. In a room, the room's
// seed stands in for a play: each account reports its online match's result
// (`submitRoomResult`) or its race's moves (`submitRaceLog`).
import * as z from "zod/mini";

import type { BotDifficulty, GameResult, PackedLog, TimerPreset, TurnMove } from "@kefche/game-sdk";

import { localStorageOrUndefined } from "@/features/account/account-state";
import { readAccountSummary } from "@/features/account/account-summary";
import { getSupabase, hasStoredSession } from "@/lib/supabase/client";

export interface Play {
  id: string;
  seed: string;
}

const playSchema = z.object({
  id: z.string().check(z.minLength(1), z.maxLength(64)),
  seed: z.string().check(z.minLength(1), z.maxLength(64)),
});

/** True when this browser holds an account's session; guests and nobody don't. */
export const isAccount = (): boolean =>
  hasStoredSession() && readAccountSummary(localStorageOrUndefined()) !== null;

async function requestPlay(gameId: string, version: number): Promise<Play | null> {
  if (!isAccount()) return null;
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("start_play", {
    p_game_id: gameId,
    p_game_version: version,
  });
  if (error) return null;
  const parsed = playSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export interface PlaySupply {
  /** Asks for a play, if none is ready or on its way. */
  prefetch(): void;
  /** The ready play (or null), and asks for the next. */
  take(): Play | null;
}

export function createPlaySupply(gameId: string, version: number): PlaySupply {
  let pending: Promise<Play | null> | null = null;
  let ready: Play | null = null;
  const ask = () => {
    const request = requestPlay(gameId, version).catch(() => null);
    pending = request;
    void request.then((play) => {
      if (pending !== request) return;
      ready = play;
      pending = null;
    });
  };
  return {
    prefetch() {
      if (!ready && !pending) ask();
    },
    take() {
      const play = ready;
      ready = null;
      if (!pending) ask();
      return play;
    },
  };
}

/** A finished game, as the player sends it to `submit-match`. */
export type PlayRecord = {
  playId: string;
  gameId: string;
  version: number;
  result: GameResult;
  /** Play time, pauses left out. */
  durationMs: number;
} & (
  | {
      /** Single-player games: the engine config and every action, packed. */
      mode: "solo";
      config: unknown;
      log: PackedLog;
    }
  | {
      /** Turn games on this device: the setup, the moves and any loss on time. */
      mode: "solo-bots" | "hotseat";
      config: unknown;
      timer: TimerPreset;
      seats: ({ kind: "human" } | { kind: "bot"; difficulty: BotDifficulty; level?: number })[];
      moves: TurnMove<unknown>[];
      timedOut?: number;
    }
);

/**
 * Sends a finished game, or a room's result, for the server to check and
 * count. Failures are dropped: the game was played either way, and the
 * results screen doesn't wait for this.
 */
async function submit(body: Record<string, unknown>): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;
  await supabase.functions.invoke("submit-match", { body }).catch(() => null);
}

export const submitPlay = (record: PlayRecord) => submit({ play: record });

/**
 * An online casual game's result as this account saw it. The match counts
 * when every account in it reports the same (rated games have their own way).
 */
export function submitRoomResult(roomId: string, seed: string, result: GameResult): void {
  if (!isAccount()) return;
  const { completed, outcome } = result;
  void submit({ room: { roomId, seed, result: { completed, ...(outcome ? { outcome } : {}) } } });
}

/** This account's moves in a race, for the server to replay on the room's seed. */
export function submitRaceLog(roomId: string, seed: string, log: PackedLog): void {
  if (isAccount()) void submit({ race: { roomId, seed, log } });
}
