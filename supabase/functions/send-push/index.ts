// send-push: delivers a new notification to its player's devices by Web Push
// (SPEC §8.4; Phase 8 step 12). Called by the database (private.request_push,
// through pg_net) with a shared secret, not a user token (verify_jwt = false
// in config.toml), once the notification is stored.
//
// It loads the notification and the devices (push_load), words it in the
// player's language as the notifications page does (_shared/push-text.ts),
// encrypts and signs it for each device (_shared/web-push.ts), and reports
// what each push service answered (push_record), which drops subscriptions
// that are gone.
//
// POST, Authorization: Bearer <SEND_PUSH_SECRET>
//   Body: { "notification": <id> }
//   → { "sent": n, "gone": n, "failed": n }, or { "skipped": true } when
//     there's nothing to send. Without the VAPID keys: push_off (503).
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { bearer, env, fail, json, log } from "../_shared/http.ts";
import { pushMessage } from "../_shared/push-text.ts";
import { type Device, endpointAllowed, pushOutcome, pushRequest } from "../_shared/web-push.ts";

const bodySchema = z.object({ notification: z.int().positive() });

const loadedSchema = z.object({
  notification: z.object({
    id: z.number(),
    type: z.string(),
    data: z.record(z.string(), z.unknown()),
    at: z.string(),
    from: z.nullable(z.object({ id: z.string(), nickname: z.string() }).loose()),
  }),
  locale: z.string(),
  devices: z.array(
    z.object({ id: z.string(), endpoint: z.string(), p256dh: z.string(), auth: z.string() }),
  ),
});

/** A push service that doesn't answer within this is counted as failed. */
const TIMEOUT_MS = 10_000;

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
  const secret = Deno.env.get("SEND_PUSH_SECRET");
  const token = bearer(req);
  if (!secret || !token || !sameSecret(token, secret)) return fail("unauthorized", 401);

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT");
  if (!publicKey || !privateKey || !subject) return fail("push_off", 503);

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid_request", 400);

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const loaded = await admin.rpc("push_load", { p_notification: body.data.notification });
  if (loaded.error) {
    log("error", "push_load_failed", { error: loaded.error.message });
    return fail("push_failed", 500);
  }
  if (loaded.data === null) return json({ skipped: true });
  const parsed = loadedSchema.safeParse(loaded.data);
  if (!parsed.success) {
    log("error", "push_load_invalid", { notification: body.data.notification });
    return fail("push_failed", 500);
  }
  const { notification, locale, devices } = parsed.data;
  const message = pushMessage(notification, locale);
  if (!message || devices.length === 0) return json({ skipped: true });

  const vapid = { subject, publicKey, privateKey };
  const send = async (device: Device): Promise<"sent" | "gone" | "failed"> => {
    // The database refuses other endpoints; this is the second lock.
    if (!endpointAllowed(device.endpoint)) return "gone";
    try {
      const { url, init } = pushRequest(device, message, vapid);
      const answer = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
      await answer.body?.cancel();
      const outcome = pushOutcome(answer.status);
      if (outcome === "failed") {
        log("warn", "push_refused", { device: device.id, status: answer.status });
      }
      return outcome;
    } catch (e) {
      // A key that doesn't encrypt, a timeout or a network error.
      log("warn", "push_send_failed", {
        device: device.id,
        error: e instanceof Error ? e.message : String(e),
      });
      return "failed";
    }
  };
  const outcomes = await Promise.all(devices.map(send));
  const results = devices.map((device, i) => ({ id: device.id, outcome: outcomes[i] }));
  const recorded = await admin.rpc("push_record", { p_results: results });
  if (recorded.error) log("error", "push_record_failed", { error: recorded.error.message });

  const count = (outcome: string) => outcomes.filter((o) => o === outcome).length;
  return json({ sent: count("sent"), gone: count("gone"), failed: count("failed") });
});
