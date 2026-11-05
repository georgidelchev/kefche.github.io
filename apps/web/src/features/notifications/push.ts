// Web Push on this device (SPEC §8.4; Phase 8 step 12): opt-in per device
// from settings. Turning it on asks the browser's permission, registers the
// push-only service worker (public/push-sw.js) and saves the subscription
// for the signed-in player; turning it off, or signing out, deletes it, so
// the next player on this browser doesn't get this one's notifications.
// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import type { Supabase } from "@/lib/supabase/client";

export type PushState = "unsupported" | "install" | "denied" | "off" | "on";

const WORKER = "/push-sw.js";

const subscriptionSchema = z.object({
  endpoint: z.string(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

const supported = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** iPhone and iPad allow push only from a web app added to the Home Screen (iOS 16.4+). */
function needsInstall(): boolean {
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios && !matchMedia("(display-mode: standalone)").matches;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!supported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

async function save(supabase: Supabase, subscription: PushSubscription): Promise<boolean> {
  const parsed = subscriptionSchema.safeParse(subscription.toJSON());
  if (!parsed.success) return false;
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
  });
  return !error;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64url.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Whether a subscription was made with this key (a new key needs a new subscription). */
function sameKey(subscription: PushSubscription, key: Uint8Array): boolean {
  const own = subscription.options.applicationServerKey;
  if (!own) return false;
  const bytes = new Uint8Array(own);
  return bytes.length === key.length && bytes.every((b, i) => b === key[i]);
}

/**
 * This device's state. A subscription found is saved again, which keeps it
 * with whoever is signed in here now.
 */
export async function pushState(supabase: Supabase): Promise<PushState> {
  if (needsInstall()) return "install";
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const subscription = await currentSubscription();
  if (!subscription) return "off";
  await save(supabase, subscription);
  return "on";
}

/** Asks permission and subscribes this device; "failed" when the browser or the save refused. */
export async function turnOnPush(
  supabase: Supabase,
  vapidKey: string,
): Promise<PushState | "failed"> {
  if (!supported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "off";
  try {
    await navigator.serviceWorker.register(WORKER, { scope: "/" });
    const registration = await navigator.serviceWorker.ready;
    const key = keyBytes(vapidKey);
    let subscription = await registration.pushManager.getSubscription();
    if (subscription && !sameKey(subscription, key)) {
      await subscription.unsubscribe();
      subscription = null;
    }
    subscription ??= await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    });
    return (await save(supabase, subscription)) ? "on" : "failed";
  } catch {
    return "failed";
  }
}

/** Unsubscribes this device and forgets it; false when the database didn't hear it. */
export async function turnOffPush(supabase: Supabase): Promise<boolean> {
  try {
    const subscription = await currentSubscription();
    if (!subscription) return true;
    const { error } = await supabase.rpc("delete_push_subscription", {
      p_endpoint: subscription.endpoint,
    });
    await subscription.unsubscribe();
    return !error;
  } catch {
    return false;
  }
}
