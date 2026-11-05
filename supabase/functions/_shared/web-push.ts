// Web Push for send-push (Phase 8 step 12): each message encrypted for its
// device (RFC 8291, aes128gcm) and signed with the site's VAPID key (RFC
// 8292) by web-push, then sent with fetch. Only the push services of the
// major browsers are accepted as endpoints, so a stored subscription can't
// make the function call anywhere else; the database checks the same list.
// @ts-types="@types/web-push"
import webpush from "web-push";

import type { PushMessage } from "./push-text.ts";

export interface Device {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface Vapid {
  subject: string;
  publicKey: string;
  privateKey: string;
}

/** Chrome, Edge, Firefox and Safari's push services (save_push_subscription's list). */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
];

export function endpointAllowed(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === "https:" && url.port === "" && PUSH_HOSTS.some((h) => h.test(url.hostname))
    );
  } catch {
    return false;
  }
}

/** How long a push service keeps a message for a device that's offline. */
const TTL_SECONDS = 24 * 60 * 60;

/** The request that delivers `message` to `device`. */
export function pushRequest(device: Device, message: PushMessage, vapid: Vapid) {
  const details = webpush.generateRequestDetails(
    { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
    JSON.stringify(message),
    {
      vapidDetails: vapid,
      contentEncoding: "aes128gcm",
      TTL: TTL_SECONDS,
      urgency: "normal",
    },
  );
  // As strings (TTL comes as a number); fetch sets the length itself.
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(details.headers)) {
    if (name.toLowerCase() !== "content-length") headers[name] = String(value);
  }
  return {
    url: details.endpoint,
    init: { method: "POST", headers, body: details.body as Uint8Array } satisfies RequestInit,
  };
}

/** What a push service's answer means for the subscription. */
export function pushOutcome(status: number): "sent" | "gone" | "failed" {
  if (status >= 200 && status < 300) return "sent";
  // The browser unsubscribed or the subscription expired.
  if (status === 404 || status === 410) return "gone";
  return "failed";
}
