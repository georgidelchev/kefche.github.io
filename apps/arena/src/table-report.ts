// A table's finished match goes to submit-match (with ARENA_SECRET), which
// replays it from the table's seed and records it once (Phase 12). A failed
// report is tried twice more; the match key makes a repeat harmless.
import type { TurnMove } from "@kefche/game-sdk";

import type { Env } from "./env";

export interface TableReport {
  roomId: string;
  /** The room's match (its settings.seed). */
  match: string;
  gameId: string;
  version: number;
  /** The table's own seed, secret until the end. */
  seed: string;
  moves: readonly TurnMove<unknown>[];
  /** The seat whose time ran out, when that ended the match. */
  timedOut: number | null;
}

const RETRY_MS = [1_000, 5_000];

export async function reportTable(env: Env, table: TableReport): Promise<void> {
  if (!env.ARENA_SECRET) return;
  const body = JSON.stringify({ table });
  for (let attempt = 0; ; attempt++) {
    let status = 0;
    try {
      const response = await fetch(`${env.SUPABASE_URL}/functions/v1/submit-match`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.ARENA_SECRET}`,
          "Content-Type": "application/json",
        },
        body,
      });
      status = response.status;
      if (response.ok) return;
    } catch {
      // The network; tried again below.
    }
    const wait = RETRY_MS[attempt];
    if (status === 400 || wait === undefined) {
      console.error("table: match not reported", { status, game: table.gameId });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}
