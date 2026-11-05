// Reporting lives to submit-match (Phase 9): the arena ran the game, so its
// word is the result. Each life has a key, so a report sent twice counts once;
// a failed report is tried twice more.
import type { Env } from "./env";

export interface LifeReport {
  /** Unique to the life, the same in every retry. */
  life: string;
  userId: string;
  arena: string;
  score: number;
  kills: number;
  durationMs: number;
  end: "knockout" | "edge" | "left";
}

const RETRY_MS = [1_000, 5_000];

export async function reportLives(
  env: Env,
  gameId: string,
  version: number,
  lives: readonly LifeReport[],
): Promise<void> {
  if (!env.ARENA_SECRET || lives.length === 0) return;
  const body = JSON.stringify({ arena: { gameId, version, lives } });
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
    // A refused report (400) won't do better the next time.
    const wait = RETRY_MS[attempt];
    if (status === 400 || wait === undefined) {
      console.error("arena: lives not reported", { status, lives: lives.length });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}
