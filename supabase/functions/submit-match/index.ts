// submit-match: the server's result for every game that counts (SPEC §12.5).
// No client says who won or what it scored.
//
// - Rated games (Phase 6, chess): the function replays the actions the
//   players recorded (rated_action: their own seat, the server's time) with
//   chess.js, runs both clocks from those times and works the result out
//   itself (_shared/chess-rated.ts). It stores the match and both players'
//   new Glicko-2 ratings once (_shared/glicko2.ts).
// - An account's own games (Phase 7): the player sends the record of a game
//   played on a seed the server issued (start_play). The function replays it
//   with the game's own engine (_shared/engines.ts), checks the result and
//   the times (_shared/solo-play.ts), and stores the match and the stats once.
// A game that doesn't replay is stored for review and counts for nothing.
//
// POST, Authorization: Bearer <a player's access token>
//   Body: { "roomId": "<uuid>", "seed": "<the match's seed>" }: a rated game.
//   → { "pending": true, "retryInMs": n } while the game is still on, or
//     { "matchId", "status", "reason", "outcome", "ratings": [{ "before", "after" }] }
//   Body: { "play": <record> }: an account's own game (apps/web/src/features/games/plays.ts).
//   → { "matchId", "status", "reason", "score", "timeMs", "assisted" }
// POST, Authorization: Bearer <SUBMIT_MATCH_SECRET>, from pg_cron
//   Body: { "sweep": true }: decides rated games whose room is gone.
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import * as z from "zod";

import { decide } from "../_shared/chess-rated.ts";
import { GAMES } from "../_shared/engines.ts";
import { rate } from "../_shared/glicko2.ts";
import { bearer, env, fail, json, log } from "../_shared/http.ts";
import { judgeSolo, soloRecordSchema } from "../_shared/solo-play.ts";

const playerBody = z.object({ roomId: z.uuid(), seed: z.string().min(1).max(64) });
const sweepBody = z.object({ sweep: z.literal(true) });
const playBody = z.object({ play: soloRecordSchema });

const playSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  gameId: z.string(),
  gameVersion: z.number().int(),
  seed: z.string(),
  startedAt: z.string(),
  matchId: z.uuid().nullable(),
  now: z.string(),
});

const ratingSchema = z.object({
  rating: z.number(),
  rd: z.number(),
  volatility: z.number(),
  games: z.number().int(),
});
const loadedSchema = z.object({
  id: z.uuid(),
  gameId: z.string(),
  pool: z.string(),
  timer: z.object({ kind: z.literal("clock"), base: z.number(), increment: z.number() }),
  players: z.array(z.uuid()).length(2),
  names: z.array(z.string()).length(2),
  startedAt: z.string(),
  matchId: z.uuid().nullable(),
  now: z.string(),
  ratings: z.array(ratingSchema).length(2),
  moves: z.array(z.object({ seat: z.number().int(), action: z.unknown(), at: z.string() })),
});
type Loaded = z.infer<typeof loadedSchema>;

type Settled =
  | { pending: true; retryInMs: number }
  | {
      matchId: string;
      status: "counted" | "review";
      reason: string;
      outcome: [number, number];
      ratings: { before: number; after: number | null }[];
    };

/** Constant-time comparison, so the secret can't be guessed byte by byte. */
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

async function load(
  admin: SupabaseClient,
  key: { game: string } | { room: string; seed: string },
): Promise<Loaded | null> {
  const { data, error } = await admin.rpc("rated_game_load", {
    p_game: "game" in key ? key.game : null,
    p_room: "room" in key ? key.room : null,
    p_seed: "seed" in key ? key.seed : null,
  });
  if (error) throw new Error(`rated_game_load: ${error.message}`);
  if (data === null) return null;
  return loadedSchema.parse(data);
}

/** The result already stored for a match (the other player asked first). */
async function stored(admin: SupabaseClient, matchId: string): Promise<Settled> {
  const [match, players] = await Promise.all([
    admin.from("matches").select("status, reason").eq("id", matchId).single(),
    admin
      .from("match_participants")
      .select("seat, outcome, rating_before, rating_after")
      .eq("match_id", matchId)
      .order("seat"),
  ]);
  if (match.error || players.error) {
    throw new Error(`stored match: ${(match.error ?? players.error)?.message ?? ""}`);
  }
  const rows = players.data;
  return {
    matchId,
    status: match.data.status === "review" ? "review" : "counted",
    reason: match.data.reason,
    outcome: [Number(rows[0]?.outcome ?? 0), Number(rows[1]?.outcome ?? 0)],
    ratings: rows.map((r) => ({ before: r.rating_before ?? 1500, after: r.rating_after })),
  };
}

/** Decides the game and, once it's over, stores the result (retrying if a rating moved meanwhile). */
async function settle(admin: SupabaseClient, game: Loaded, attempt = 0): Promise<Settled> {
  if (game.matchId) return stored(admin, game.matchId);
  const verdict = decide(
    {
      clock: { base: game.timer.base, increment: game.timer.increment },
      startedAt: new Date(game.startedAt),
      names: [game.names[0] ?? "?", game.names[1] ?? "?"],
      pool: game.pool,
    },
    game.moves.map((m) => ({ seat: m.seat, action: m.action, at: new Date(m.at) })),
    new Date(game.now),
  );
  if (!verdict.over) {
    return {
      pending: true,
      retryInMs: Math.max(1000, verdict.flagAt.getTime() - new Date(game.now).getTime()),
    };
  }
  const status = verdict.refused > 0 ? "review" : "counted";
  const [white, black] = game.ratings as [Loaded["ratings"][0], Loaded["ratings"][0]];
  const next = [
    rate(white, [{ opponent: black, score: verdict.outcome[0] }]),
    rate(black, [{ opponent: white, score: verdict.outcome[1] }]),
  ];
  const { data, error } = await admin.rpc("rated_game_record", {
    p_game: game.id,
    p_result: {
      status,
      reason: verdict.reason,
      pgn: verdict.pgn,
      endedAt: verdict.endedAt.toISOString(),
      outcome: verdict.outcome,
      ratings: next.map((r, seat) => ({ ...r, gamesBefore: game.ratings[seat]?.games ?? 0 })),
    },
  });
  if (error?.message === "ratings_changed" && attempt < 2) {
    const fresh = await load(admin, { game: game.id });
    if (fresh) return settle(admin, fresh, attempt + 1);
  }
  if (error) throw new Error(`rated_game_record: ${error.message}`);
  log("info", "rated_game", { game: game.id, match: data, status, reason: verdict.reason });
  return {
    matchId: z.uuid().parse(data),
    status,
    reason: verdict.reason,
    outcome: verdict.outcome,
    ratings: game.ratings.map((r, seat) => ({
      before: r.rating,
      after: status === "counted" ? (next[seat]?.rating ?? null) : null,
    })),
  };
}

/** An account's own game: replayed, judged and stored once. */
async function submitPlay(admin: SupabaseClient, user: User, body: unknown): Promise<Response> {
  const parsed = playBody.safeParse(body);
  if (!parsed.success) return fail("bad_request", 400);
  const record = parsed.data.play;
  if (user.is_anonymous) return fail("account_required", 403);
  const loaded = await admin.rpc("play_load", { p_play: record.playId });
  if (loaded.error) throw new Error(`play_load: ${loaded.error.message}`);
  if (loaded.data === null) return fail("play_not_found", 404);
  const play = playSchema.parse(loaded.data);
  if (play.userId !== user.id) return fail("play_not_found", 404);
  if (play.matchId) {
    const { data, error } = await admin
      .from("matches")
      .select("status, reason, match_participants(score, time_ms, assisted)")
      .eq("id", play.matchId)
      .single();
    if (error) throw new Error(`stored play: ${error.message}`);
    const [player] = data.match_participants;
    return json({
      matchId: play.matchId,
      status: data.status,
      reason: data.reason,
      score: player?.score ?? null,
      timeMs: player?.time_ms ?? null,
      assisted: player?.assisted ?? false,
    });
  }
  const game = GAMES.get(play.gameId);
  if (game?.kind !== "race" || record.gameId !== play.gameId) return fail("bad_request", 400);
  // A game updated since the play began is played to its old rules: it can't be judged.
  if (record.version !== play.gameVersion || game.version !== play.gameVersion) {
    return fail("game_updated", 409);
  }
  const verdict = judgeSolo(
    game,
    { seed: play.seed, startedAt: new Date(play.startedAt), now: new Date(play.now) },
    record,
  );
  const stored = await admin.rpc("play_record", {
    p_play: play.id,
    p_result: { ...verdict, log: record.log },
  });
  if (stored.error) throw new Error(`play_record: ${stored.error.message}`);
  log("info", "play", {
    play: play.id,
    game: play.gameId,
    status: verdict.status,
    reason: verdict.reason,
  });
  return json({
    matchId: z.uuid().parse(stored.data),
    status: verdict.status,
    reason: verdict.reason,
    score: verdict.score,
    timeMs: verdict.timeMs,
    assisted: verdict.assisted,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json(null);
  if (req.method !== "POST") return fail("method_not_allowed", 405);
  const token = bearer(req);
  if (!token) return fail("unauthorized", 401);
  const body: unknown = await req.json().catch(() => null);
  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // The scheduled job: games nobody is left to ask about.
    const secret = Deno.env.get("SUBMIT_MATCH_SECRET");
    if (secret && sameSecret(token, secret)) {
      if (!sweepBody.safeParse(body).success) return fail("bad_request", 400);
      const due = await admin.rpc("due_rated_games", { p_limit: 20 });
      if (due.error) throw new Error(`due_rated_games: ${due.error.message}`);
      let settled = 0;
      for (const id of z.array(z.uuid()).parse(due.data ?? [])) {
        const game = await load(admin, { game: id });
        if (game && !("pending" in (await settle(admin, game)))) settled++;
      }
      return json({ settled });
    }

    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError) return fail("unauthorized", 401);
    // An account's own game.
    if (typeof body === "object" && body !== null && "play" in body) {
      return await submitPlay(admin, auth.user, body);
    }

    // A player asking for their rated game's result.
    const parsed = playerBody.safeParse(body);
    if (!parsed.success) return fail("bad_request", 400);
    const game = await load(admin, { room: parsed.data.roomId, seed: parsed.data.seed });
    if (!game) return fail("game_not_found", 404);
    if (!game.players.includes(auth.user.id)) return fail("not_a_player", 403);
    return json(await settle(admin, game));
  } catch (e) {
    log("error", "submit_match_failed", { error: e instanceof Error ? e.message : String(e) });
    return fail("submit_failed", 500);
  }
});
