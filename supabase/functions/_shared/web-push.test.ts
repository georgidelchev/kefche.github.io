// Push requests decrypt on the device to the message sent, carry a VAPID
// signature from the site's key, and go only to the browsers' push services.
// Run: deno test _shared/web-push.test.ts
import { createECDH, randomBytes } from "node:crypto";

import ece from "http_ece";
// @ts-types="@types/web-push"
import webpush from "web-push";

import { endpointAllowed, pushOutcome, pushRequest } from "./web-push.ts";

function same(actual: unknown, wanted: unknown, what: string) {
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${what}: ${JSON.stringify(actual)}, expected ${JSON.stringify(wanted)}`);
  }
}

const message = {
  title: "kefche",
  body: "Ana иска да сте приятели.",
  url: "/bg/friends/",
  tag: "t",
  lang: "bg",
  dir: "ltr" as const,
};

Deno.test("the device decrypts the message", () => {
  const vapid = { subject: "mailto:push@example.com", ...webpush.generateVAPIDKeys() };
  const device = createECDH("prime256v1");
  device.generateKeys();
  const auth = randomBytes(16).toString("base64url");
  const request = pushRequest(
    {
      id: "d",
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      p256dh: device.getPublicKey("base64url"),
      auth,
    },
    message,
    vapid,
  );
  same(request.url, "https://fcm.googleapis.com/fcm/send/abc", "endpoint");
  same(request.init.headers["Content-Encoding"], "aes128gcm", "encoding");
  same(request.init.headers.TTL, "86400", "ttl");
  same(
    request.init.headers.Authorization?.startsWith(`vapid t=`) &&
      request.init.headers.Authorization.endsWith(`, k=${vapid.publicKey}`),
    true,
    "vapid",
  );
  const plain = ece.decrypt(request.init.body, {
    version: "aes128gcm",
    privateKey: device,
    authSecret: auth,
  });
  same(JSON.parse(new TextDecoder().decode(plain)), message, "message");
});

Deno.test("only the browsers' push services", () => {
  for (const ok of [
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
    "https://web.push.apple.com/abc",
  ]) {
    same(endpointAllowed(ok), true, ok);
  }
  for (const bad of [
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com:8443/x",
    "https://evil.example.com/fcm.googleapis.com",
    "https://fcm.googleapis.com.evil.example.com/x",
    "https://push.apple.com.evil.example/x",
    "https://localhost/x",
    "not a url",
  ]) {
    same(endpointAllowed(bad), false, bad);
  }
});

Deno.test("what a push service's answer means", () => {
  same(
    [201, 202, 410, 404, 413, 429, 500].map(pushOutcome),
    ["sent", "sent", "gone", "gone", "failed", "failed", "failed"],
    "outcomes",
  );
});
