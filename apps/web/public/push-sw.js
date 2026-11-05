// kefche's service worker: Web Push and nothing else (ADR-0014). It has no
// fetch handler and caches nothing, so pages and games always load from the
// network. Registered by the settings page when a player turns push on
// (src/features/notifications/push.ts). Messages come from the send-push
// Edge Function, already worded in the player's language:
// { title, body, url, tag, lang, dir }.
/* global self */

self.addEventListener("install", () => {
  self.skipWaiting();
});

/** Only a page on this site, so a message can't send anyone elsewhere. */
function siteUrl(value) {
  const home = new URL("/", self.location.origin).href;
  try {
    const url = new URL(typeof value === "string" ? value : "/", self.location.origin);
    return url.origin === self.location.origin ? url.href : home;
  } catch {
    return home;
  }
}

/** The message, or null when it isn't JSON. */
function read(event) {
  try {
    return event.data ? event.data.json() : null;
  } catch {
    return null;
  }
}

self.addEventListener("push", (event) => {
  const message = read(event);
  if (!message || typeof message.body !== "string") return;
  const text = (value) => (typeof value === "string" ? value : undefined);
  event.waitUntil(
    self.registration.showNotification(text(message.title) ?? "kefche", {
      body: message.body,
      tag: text(message.tag),
      lang: text(message.lang),
      dir: message.dir === "rtl" ? "rtl" : "auto",
      icon: "/icon-192.png",
      data: { url: siteUrl(message.url) },
    }),
  );
});

// Opens what the notification is about: an open tab already there, or a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = siteUrl(event.notification.data?.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => client.url === url);
      if (open) return open.focus();
      return self.clients.openWindow(url);
    })(),
  );
});
