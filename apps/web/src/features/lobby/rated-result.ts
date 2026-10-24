// A rated match's result as the server works it out (Edge Function
// submit-match, SPEC §12.5). The host's screen shows who won at once; the
// rating change comes from the server, which replays the moves it recorded.
// While the server still thinks the game is on (a flag about to fall, with
// its grace), it says when to ask again.
import * as z from "zod/mini";

import type { Supabase } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.gen";

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Records one of the player's actions in the server's record of a rated
 * match. A lost move would leave the record incomplete (and the game set
 * aside for review), so a failed request is tried again; an error the
 * database raised (no longer a member, the match is over) is final.
 */
export async function recordRatedAction(
  supabase: Supabase,
  roomId: string,
  action: Json,
): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { error } = await supabase.rpc("rated_action", { p_room: roomId, p_action: action });
    if (!error || error.code) return;
    await wait(500 * 2 ** attempt);
  }
}

export type RatedOutcome =
  | { kind: "rated"; before: number; after: number; matchId: string }
  | { kind: "review" }
  | { kind: "failed" };

const response = z.union([
  z.object({ pending: z.literal(true), retryInMs: z.number() }),
  z.object({
    matchId: z.string(),
    status: z.enum(["counted", "review"]),
    ratings: z.array(z.object({ before: z.number(), after: z.nullable(z.number()) })),
  }),
]);

const ATTEMPTS = 8;
const RETRY_CAP_MS = 10_000;

/** Asks for the match's result until the server has one (or gives up), for `seat`'s rating. */
export async function fetchRatedOutcome(
  supabase: Supabase,
  match: { roomId: string; seed: string; seat: number },
  cancelled: () => boolean,
): Promise<RatedOutcome | null> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (cancelled()) return null;
    const reply = await supabase.functions.invoke<unknown>("submit-match", {
      body: { roomId: match.roomId, seed: match.seed },
    });
    const parsed = reply.error ? null : response.safeParse(reply.data);
    if (!parsed?.success) {
      await wait(2000);
      continue;
    }
    const answer = parsed.data;
    if ("pending" in answer) {
      await wait(Math.min(Math.max(answer.retryInMs, 500), RETRY_CAP_MS));
      continue;
    }
    if (answer.status === "review") return { kind: "review" };
    const mine = answer.ratings[match.seat];
    if (mine?.after != null)
      return {
        kind: "rated",
        before: mine.before,
        after: mine.after,
        matchId: answer.matchId,
      };
    return { kind: "failed" };
  }
  return { kind: "failed" };
}
