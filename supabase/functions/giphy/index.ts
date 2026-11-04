// giphy: GIF search and trending for the chat (SPEC §8.2, Phase 8 step 10),
// so the GIPHY key stays on the server. Signed-in accounts only (guests
// have no global chat or DMs).
//
// POST, Authorization: Bearer <access token>
// Body: { "q"?: string, "offset"?: number, "lang"?: string }
//   without q: trending; with q: a search in that language.
// Returns { "gifs": [{ id, title, width, height }], "next": offset | null }.
// The app shows a GIF from its id on GIPHY's media domain.
//
// Rated pg-13. Every id served is noted (note_gifs), and sending a message
// accepts only noted ids. Answers are cached in this instance for 10
// minutes (trending) or an hour (a search); take_gif_search limits each
// player and keeps the site under GIPHY's free 100 calls an hour.
// Without GIPHY_API_KEY it answers 503 gifs_off.
import { createClient } from "@supabase/supabase-js";
import * as z from "zod";

import { bearer, env, fail, json, log } from "../_shared/http.ts";

const PAGE = 24;
const LANGS = ["en", "es", "pt", "fr", "de", "ru", "zh-CN", "hi", "ar", "ja", "bg"] as const;

const bodySchema = z.object({
  q: z.string().trim().max(50).optional(),
  offset: z.int().min(0).max(4999).default(0),
  lang: z.enum(LANGS).default("en"),
});

const giphySchema = z.object({
  data: z.array(
    z.object({
      id: z.string().regex(/^[A-Za-z0-9]{1,64}$/),
      title: z.string().catch(""),
      images: z.object({
        fixed_height: z.object({ width: z.coerce.number(), height: z.coerce.number() }),
      }),
    }),
  ),
  pagination: z
    .object({ total_count: z.number(), count: z.number(), offset: z.number() })
    .optional(),
});

interface Answer {
  gifs: { id: string; title: string; width: number; height: number }[];
  next: number | null;
}

const cache = new Map<string, { at: number; answer: Answer }>();
const CACHE_SIZE = 300;

function cached(key: string, ttl: number): Answer | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttl) {
    cache.delete(key);
    return null;
  }
  return hit.answer;
}

function remember(key: string, answer: Answer) {
  if (cache.size >= CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), answer });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json(null);
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const apiKey = Deno.env.get("GIPHY_API_KEY");
  if (!apiKey) return fail("gifs_off", 503);

  const token = bearer(req);
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!token || !body.success) return fail("bad_request", 400);

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: who, error: authError } = await admin.auth.getUser(token);
  if (authError || who.user.is_anonymous) return fail("unauthorized", 401);

  const { q, offset, lang } = body.data;
  const search = q && q.length > 0 ? q.toLowerCase() : null;
  const key = search ? `search:${lang}:${search}:${String(offset)}` : `trending:${String(offset)}`;
  const hit = cached(key, search ? 3_600_000 : 600_000);

  const { data: allowed, error: limitError } = await admin.rpc("take_gif_search", {
    p_user: who.user.id,
    p_remote: hit === null,
  });
  if (limitError) {
    log("error", "giphy_limit_failed", { error: limitError.message });
    return fail("failed", 500);
  }
  if (allowed === "rate_limited") return fail("rate_limited", 429);
  if (hit) return json(hit);
  if (allowed === "busy") return fail("busy", 503);

  const url = new URL(
    search ? "https://api.giphy.com/v1/gifs/search" : "https://api.giphy.com/v1/gifs/trending",
  );
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("limit", String(PAGE));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("rating", "pg-13");
  url.searchParams.set("bundle", "messaging_non_clips");
  if (search) {
    url.searchParams.set("q", search);
    url.searchParams.set("lang", lang);
  }
  const res = await fetch(url).catch(() => null);
  const parsed = giphySchema.safeParse(res?.ok ? await res.json().catch(() => null) : null);
  if (!parsed.success) {
    log("warn", "giphy_failed", { status: res?.status ?? null });
    return fail("failed", 502);
  }

  const gifs = parsed.data.data.map((g) => ({
    id: g.id,
    title: g.title.slice(0, 100),
    width: g.images.fixed_height.width,
    height: g.images.fixed_height.height,
  }));
  const page = parsed.data.pagination;
  const next =
    page && page.offset + page.count < Math.min(page.total_count, 5000) && gifs.length > 0
      ? page.offset + page.count
      : null;
  const answer: Answer = { gifs, next };

  const { error: noteError } = await admin.rpc("note_gifs", { p_ids: gifs.map((g) => g.id) });
  if (noteError) {
    log("error", "giphy_note_failed", { error: noteError.message });
    return fail("failed", 500);
  }
  remember(key, answer);
  return json(answer);
});
