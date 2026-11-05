// Push messages read as the notifications page reads them, in the player's
// language, and lead where the bell leads.
// Run: deno test _shared/push-text.test.ts
import { pushMessage, type PushNotification } from "./push-text.ts";

function same(actual: unknown, wanted: unknown, what: string) {
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${what}: ${JSON.stringify(actual)}, expected ${JSON.stringify(wanted)}`);
  }
}

const from = { id: "8d1c1d59-0d0c-4a7e-9a52-3c0c3a6c2a10", nickname: "Ana" };
const note = (
  type: string,
  data: Record<string, unknown>,
  sender: PushNotification["from"] = from,
): PushNotification => ({
  id: 7,
  type,
  data,
  at: "2026-11-05T10:00:00Z",
  from: sender,
});

Deno.test("a friend request, in the player's language", () => {
  same(
    pushMessage(note("friend_request", { user: from.id }), "en"),
    {
      title: "kefche",
      body: "Ana wants to be your friend.",
      url: "/en/friends/?tab=requests",
      tag: "notification:7",
      lang: "en",
      dir: "ltr",
    },
    "en",
  );
  same(pushMessage(note("friend_request", {}), "bg")?.body, "Ana иска да сте приятели.", "bg");
  same(pushMessage(note("friend_request", {}), "bg")?.url, "/bg/friends/?tab=requests", "bg url");
});

Deno.test("Arabic reads right to left", () => {
  const m = pushMessage(note("friend_request", {}), "ar");
  same([m?.lang, m?.dir], ["ar", "rtl"], "ar");
});

Deno.test("an unknown language falls back to English", () => {
  same(pushMessage(note("friend_request", {}), "xx")?.url, "/en/friends/?tab=requests", "url");
});

Deno.test("an invite names the game and leads into the room", () => {
  const m = pushMessage(note("invite", { game: "chess", code: "ABCDEF", room: "r" }), "en");
  same(m?.body, "Ana invites you to play Chess.", "body");
  same(m?.url, "/en/play/chess/?room=ABCDEF", "url");
});

Deno.test("messages share one tag per conversation", () => {
  const m = pushMessage(note("message", { user: from.id }), "en");
  same(m?.tag, `message:${from.id}`, "tag");
  same(m?.url, `/en/messages/?with=${from.id}`, "url");
});

Deno.test("an achievement and a rating are named", () => {
  same(
    pushMessage(
      note("achievement", { achievement: "global.regular", tier: "gold" }, null),
      "en",
    )?.body.startsWith("Achievement unlocked: "),
    true,
    "achievement",
  );
  same(
    pushMessage(note("rating", { game: "chess", pool: "blitz", rating: 1600 }), "en")?.url,
    "/en/leaderboards/?board=chess.rating-blitz",
    "rating url",
  );
});

Deno.test("a sanction leaves out its end, which the bell shows", () => {
  const m = pushMessage(
    note("moderation", { kind: "mute", reason: "spam", endsAt: "2026-11-05T12:00:00Z" }),
    "en",
  );
  same(m?.body, "You're muted. Reason: spam.", "body");
  same(m?.url, "/en/notifications/", "url");
});

Deno.test("nothing for a type this version doesn't know", () => {
  same(pushMessage(note("something_new", {}), "en"), null, "unknown");
});
