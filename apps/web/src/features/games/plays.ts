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

import { rewardsFrom, type Rewards } from "./rewards";

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
 * count, and returns what it gave the player (null when it can't tell).
 * Failures are dropped: the game was played either way.
 */
async function submit(body: Record<string, unknown>): Promise<ReturnType<typeof rewardsFrom>> {
  const supabase = await getSupabase();
  const reply = await supabase?.functions
    .invoke<unknown>("submit-match", { body })
    .catch(() => null);
  return rewardsFrom(reply?.error ? null : reply?.data);
}

export const submitPlay = async (record: PlayRecord): Promise<Rewards | null> =>
  (await submit({ play: record })).rewards;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** Times an undecided room match is asked about again, and how far apart. */
const ROOM_ASKS = 5;
const ROOM_ASK_MS = 3000;

/**
 * An online casual game's result as this account saw it, and what it gave
 * them. The match counts when every account in it reports the same (rated
 * games have their own way), so until the others have reported, the same
 * report is sent again a few times (the server answers it with the match
 * once decided). Null for a guest, or if it isn't decided by then.
 */
export async function submitRoomResult(
  roomId: string,
  seed: string,
  result: GameResult,
): Promise<Rewards | null> {
  if (!isAccount()) return null;
  const { completed, outcome } = result;
  const body = { room: { roomId, seed, result: { completed, ...(outcome ? { outcome } : {}) } } };
  for (let ask = 0; ask < ROOM_ASKS; ask++) {
    const answer = await submit(body);
    if (answer.matchId) return answer.rewards;
    await wait(ROOM_ASK_MS);
  }
  return null;
}

/** This account's moves in a race, for the server to replay on the room's seed. */
export async function submitRaceLog(
  roomId: string,
  seed: string,
  log: PackedLog,
): Promise<Rewards | null> {
  return isAccount() ? (await submit({ race: { roomId, seed, log } })).rewards : null;
}
