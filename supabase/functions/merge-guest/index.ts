// merge-guest: moves a guest's progress into the account they just signed in
// to, then deletes the guest (SPEC §7.1).
//
// POST, Authorization: Bearer <the signed-in user's access token>
// Body: { "guestAccessToken": "<the guest session's access token>" }
// Both tokens are verified with Supabase Auth, so a caller can only merge a
// guest whose session they hold into their own account.
import { createClient } from "@supabase/supabase-js";
import * as z from "zod";

import { bearer, env, fail, json, log } from "../_shared/http.ts";

const bodySchema = z.object({ guestAccessToken: z.string().min(20).max(8192) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json(null);
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const token = bearer(req);
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!token || !body.success) return fail("bad_request", 400);

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [target, guest] = await Promise.all([
    admin.auth.getUser(token),
    admin.auth.getUser(body.data.guestAccessToken),
  ]);
  if (target.error || guest.error) return fail("unauthorized", 401);
  const targetUser = target.data.user;
  const guestUser = guest.data.user;
  if (targetUser.is_anonymous || !guestUser.is_anonymous || targetUser.id === guestUser.id) {
    return fail("not_mergeable", 400);
  }

  const { error } = await admin.rpc("merge_guest", {
    p_guest: guestUser.id,
    p_target: targetUser.id,
  });
  if (error) {
    if (error.message === "rate_limited") return fail("rate_limited", 429);
    log("error", "merge_guest_failed", {
      target: targetUser.id,
      guest: guestUser.id,
      error: error.message,
    });
    return fail("merge_failed", 500);
  }
  log("info", "merge_guest", { target: targetUser.id, guest: guestUser.id });
  return json({ merged: true });
});
