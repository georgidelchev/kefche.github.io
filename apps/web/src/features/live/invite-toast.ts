// An invite to a lobby, shown as it arrives (Phase 8 step 5): "{name}
// invites you to play {game}." with Join and Dismiss, in the region
// AppShell renders (`[data-live-toasts]`, with its strings and a template).
// Loaded by live.client.ts with the first notification, so pages without
// one don't download it. zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import { fill } from "@/features/games/turn/labels";

const notificationSchema = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
  from: z.nullable(z.object({ nickname: z.string() })),
});

const inviteSchema = z.object({
  room: z.string(),
  code: z.string().check(z.regex(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)),
  game: z.string().check(z.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)),
});

const stringsSchema = z.object({
  received: z.string(),
  playBase: z.string(),
  games: z.record(z.string(), z.string()),
});

/** At most this many invites show at once; the oldest goes first. */
const MAX_SHOWN = 3;
/** An invite older than this is mostly stale (the server lets it be sent again). */
const SHOWN_MS = 5 * 60_000;

export function showNotification(payload: unknown): void {
  const notification = notificationSchema.safeParse(payload);
  if (!notification.success || notification.data.type !== "invite") return;
  const invite = inviteSchema.safeParse(notification.data.data);
  const region = document.querySelector<HTMLElement>("[data-live-toasts]");
  const template = region?.querySelector("template");
  const strings = stringsSchema.safeParse(JSON.parse(region?.dataset.strings ?? "{}"));
  const from = notification.data.from;
  if (!invite.success || !region || !template || !strings.success || !from) return;
  const { room, code, game } = invite.data;

  // One per room: a repeated invite replaces the old one.
  region.querySelector(`[data-room="${CSS.escape(room)}"]`)?.remove();
  const toast = template.content.firstElementChild?.cloneNode(true);
  if (!(toast instanceof HTMLElement)) return;
  toast.dataset.room = room;
  const text = toast.querySelector("[data-text]");
  if (text) {
    text.textContent = fill(strings.data.received, {
      name: from.nickname,
      game: strings.data.games[game] ?? game,
    });
  }
  const join = toast.querySelector<HTMLAnchorElement>("a[data-join]");
  if (join) join.href = `${strings.data.playBase}${game}/?room=${code}`;
  const timer = setTimeout(() => {
    toast.remove();
  }, SHOWN_MS);
  toast.querySelector("[data-dismiss]")?.addEventListener("click", () => {
    clearTimeout(timer);
    toast.remove();
  });

  region.append(toast);
  const shown = region.querySelectorAll("[data-room]");
  for (const old of [...shown].slice(0, Math.max(0, shown.length - MAX_SHOWN))) old.remove();
}
