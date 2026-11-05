// A notification as a push message (SPEC §8.4; Phase 8 step 12), in its
// player's language and worded exactly as the notifications page words it:
// push-words.gen.js bundles the page's own wording and every locale's
// strings (`pnpm functions:push`).
import {
  LOCALE_INFO,
  notificationHref,
  notificationText,
  type PushNotification,
  WORDS,
} from "./push-words.gen.js";

export type { PushNotification };

/** What the service worker shows: apps/web/public/push-sw.js reads these fields. */
export interface PushMessage {
  title: string;
  body: string;
  /** A path on the site, in the player's language. */
  url: string;
  /** Notifications with the same tag replace each other on the device. */
  tag: string;
  lang: string;
  dir: "ltr" | "rtl";
}

/** The brand isn't translated. */
const TITLE = "kefche";

export function pushMessage(n: PushNotification, locale: string): PushMessage | null {
  const code = locale in WORDS ? locale : "en";
  const words = WORDS[code];
  const info = LOCALE_INFO[code];
  if (!words || !info) return null;
  // A sanction's end would read in the server's time zone, not the player's:
  // the push says what happened, the bell says until when.
  const data = n.type === "moderation" ? { ...n.data, endsAt: undefined } : n.data;
  const shown = { ...n, data };
  const body = notificationText(shown, words.strings, {
    games: words.games,
    achievements: words.achievements,
    locale: code,
    bcp47: info.bcp47,
  });
  if (!body) return null;
  return {
    title: TITLE,
    body,
    url: notificationHref(shown, words.paths) ?? words.paths.notifications,
    // One per conversation, so a thread's messages don't stack up.
    tag: n.type === "message" && n.from ? `message:${n.from.id}` : `notification:${String(n.id)}`,
    lang: info.bcp47,
    dir: info.dir,
  };
}
