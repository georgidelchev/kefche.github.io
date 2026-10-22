// purge-accounts: hard-deletes accounts whose 7-day deletion grace period has
// ended (SPEC §17). Called hourly by pg_cron (private.invoke_purge_accounts)
// with a shared secret, not a user token (verify_jwt = false in config.toml).
// For each account: remove its Storage files through the Storage API, then
// purge_account() deletes the user and everything that cascades from it.
import { createClient } from "@supabase/supabase-js";

import { bearer, env, fail, json, log } from "../_shared/http.ts";

const BUCKETS = ["avatars"];

/** Constant-time comparison, so the secret can't be guessed byte by byte. */
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail("method_not_allowed", 405);
  const secret = Deno.env.get("PURGE_ACCOUNTS_SECRET");
  const token = bearer(req);
  if (!secret || !token || !sameSecret(token, secret)) return fail("unauthorized", 401);

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const due = await admin.rpc("due_account_deletions", { p_limit: 50 });
  if (due.error) {
    log("error", "purge_list_failed", { error: due.error.message });
    return fail("purge_failed", 500);
  }

  let purged = 0;
  const failed: string[] = [];
  for (const userId of (due.data ?? []) as string[]) {
    try {
      for (const bucket of BUCKETS) {
        const files = await admin.storage.from(bucket).list(userId, { limit: 1000 });
        if (files.error) throw files.error;
        const paths = files.data.map((f) => `${userId}/${f.name}`);
        if (paths.length > 0) {
          const removed = await admin.storage.from(bucket).remove(paths);
          if (removed.error) throw removed.error;
        }
      }
      const { error } = await admin.rpc("purge_account", { p_user: userId });
      if (error) throw error;
      purged++;
    } catch (e) {
      failed.push(userId);
      log("error", "purge_account_failed", {
        user: userId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  log("info", "purge_accounts", { purged, failed: failed.length });
  return json({ purged, failed: failed.length });
});
