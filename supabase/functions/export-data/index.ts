// export-data: "Download my data" (SPEC §17). Returns everything kefche
// stores about the signed-in user as one JSON document.
//
// POST, Authorization: Bearer <the user's access token>. Rate-limited to a
// few exports per hour per user.
import { createClient } from "@supabase/supabase-js";

import { bearer, corsHeaders, env, fail, json, log } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json(null);
  if (req.method !== "POST") return fail("method_not_allowed", 405);
  const token = bearer(req);
  if (!token) return fail("unauthorized", 401);

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const auth = await admin.auth.getUser(token);
  if (auth.error || auth.data.user.is_anonymous) return fail("unauthorized", 401);
  const user = auth.data.user;

  const allowed = await admin.rpc("take_rate_limit", {
    p_key: `export:${user.id}`,
    p_capacity: 3,
    p_refill_per_second: 3 / 3600,
  });
  if (allowed.error) return fail("export_failed", 500);
  if (allowed.data !== true) return fail("rate_limited", 429);

  const [profile, settings, consent, roles, activity, avatars] = await Promise.all([
    admin.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    admin.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
    admin
      .from("consent_records")
      .select("categories, policy_version, created_at")
      .eq("user_id", user.id),
    admin.from("user_roles").select("role, created_at").eq("user_id", user.id),
    admin
      .from("audit_log")
      .select("action, target_type, target_id, details, created_at")
      .eq("actor_id", user.id),
    admin.storage.from("avatars").list(user.id, { limit: 1000 }),
  ]);
  const failedPart = [profile, settings, consent, roles, activity, avatars].find((r) => r.error);
  if (failedPart?.error) {
    log("error", "export_failed", { user: user.id, error: failedPart.error.message });
    return fail("export_failed", 500);
  }

  const document = {
    exported_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email ?? null,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at ?? null,
      sign_in_methods: (user.identities ?? []).map((i) => ({
        provider: i.provider,
        created_at: i.created_at,
      })),
    },
    profile: profile.data,
    settings: settings.data,
    roles: roles.data,
    consent_records: consent.data,
    activity_log: activity.data,
    avatar_files: (avatars.data ?? []).map((f) => `avatars/${user.id}/${f.name}`),
  };
  log("info", "export_data", { user: user.id });
  return new Response(JSON.stringify(document, null, 2), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kefche-data.json"',
    },
  });
});
