// The player's notifications (SPEC §8.4): `my_notifications` and
// `read_notifications`, validated, and how each type reads and where it
// leads. The database stores what a notification is about; the words are
// the reader's language's. zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import { fill } from "@/features/games/turn/labels";
import type { Supabase } from "@/lib/supabase/client";

const card = z.object({
  id: z.string(),
  nickname: z.string(),
  avatarKind: z.string(),
  avatarPreset: z.nullable(z.string()),
  avatarPath: z.nullable(z.string()),
  avatarFrame: z.nullable(z.string()),
});

export const notificationSchema = z.object({
  id: z.number(),
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
  at: z.string(),
  // Live ones (from the player's channel) arrive unread, without the field.
  read: z.optional(z.boolean()),
  from: z.nullable(card),
  // A sanction's note from the moderator, shown as written (the list has it; live ones don't).
  note: z.optional(z.nullable(z.string())),
});
export type Notification = z.infer<typeof notificationSchema>;

const pageSchema = z.object({ items: z.array(notificationSchema), unread: z.int() });

/** A page of notifications older than `before` (an id), or null when unreadable. */
export async function fetchNotifications(
  supabase: Supabase,
  before: number | null,
): Promise<z.infer<typeof pageSchema> | null> {
  const { data, error } = await supabase.rpc("my_notifications", {
    ...(before === null ? {} : { p_before: before }),
  });
  if (error) return null;
  const parsed = pageSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** Marks these notifications read (all of them without ids); the unread count left, or null. */
export async function readNotifications(
  supabase: Supabase,
  ids?: number[],
): Promise<number | null> {
  const { data, error } = await supabase.rpc("read_notifications", ids ? { p_ids: ids } : {});
  return error || typeof data !== "number" ? null : data;
}

/** The types a player can turn off (the rest always arrive), in the order settings list them. */
export const OPTIONAL_TYPES = [
  "friend_request",
  "friend_accepted",
  "invite",
  "message",
  "achievement",
  "rating",
  "daily",
] as const;
export type OptionalType = (typeof OPTIONAL_TYPES)[number];

type Reason =
  "spam" | "harassment" | "hate" | "sexual" | "selfHarm" | "cheating" | "filter" | "other";
/** A sanction's reason (the database's) to its string. */
const REASONS: Record<string, Reason> = {
  spam: "spam",
  harassment: "harassment",
  hate: "hate",
  sexual: "sexual",
  "self-harm": "selfHarm",
  cheating: "cheating",
  filter: "filter",
  other: "other",
};

export interface NotificationStrings {
  someone: string;
  types: Record<OptionalType, string>;
  moderation: {
    warn: string;
    muteUntil: string;
    mute: string;
    suspendUntil: string;
    suspend: string;
    ban: string;
    reason: string;
  };
  reasons: Record<Reason, string>;
  tiers: Record<"bronze" | "silver" | "gold", string>;
  /** Rating pools by id; an unknown pool shows its id. */
  pools: Record<string, string>;
}

/** What the page knows to name things: games and achievements by id, and the page's language. */
export interface NamingContext {
  games: Record<string, string>;
  achievements: Record<string, string>;
  /** The page's locale code ("bg"), for announcements written per language. */
  locale: string;
  bcp47: string;
}

const text = (value: unknown) => (typeof value === "string" ? value : "");
const number = (value: unknown, bcp47: string) =>
  typeof value === "number" ? value.toLocaleString(bcp47) : "";

/** The notification in words, or null for one this version doesn't know. */
export function notificationText(
  n: Notification,
  s: NotificationStrings,
  c: NamingContext,
): string | null {
  const d = n.data;
  const name = n.from?.nickname ?? s.someone;
  const game = (id: unknown) => c.games[text(id)] ?? text(id);
  switch (n.type) {
    case "friend_request":
    case "friend_accepted":
    case "message":
      return fill(s.types[n.type], { name });
    case "invite":
      return fill(s.types.invite, { name, game: game(d.game) });
    case "achievement": {
      const tier = text(d.tier);
      return fill(s.types.achievement, {
        name: c.achievements[text(d.achievement)] ?? text(d.achievement),
        tier: tier === "bronze" || tier === "silver" || tier === "gold" ? s.tiers[tier] : tier,
      });
    }
    case "rating":
      return fill(s.types.rating, {
        game: game(d.game),
        pool: s.pools[text(d.pool)] ?? text(d.pool),
        rating: number(d.rating, c.bcp47),
      });
    case "daily": {
      const day = new Date(`${text(d.day)}T00:00:00Z`);
      return fill(s.types.daily, {
        date: Number.isNaN(day.getTime())
          ? text(d.day)
          : day.toLocaleDateString(c.bcp47, { dateStyle: "medium", timeZone: "UTC" }),
        game: game(d.game),
        rank: number(d.rank, c.bcp47),
        total: number(d.total, c.bcp47),
      });
    }
    case "moderation": {
      const m = s.moderation;
      const ends = typeof d.endsAt === "string" ? new Date(d.endsAt) : null;
      const until = ends
        ? ends.toLocaleString(c.bcp47, { dateStyle: "medium", timeStyle: "short" })
        : "";
      const what =
        d.kind === "warn"
          ? m.warn
          : d.kind === "mute"
            ? ends
              ? fill(m.muteUntil, { until })
              : m.mute
            : d.kind === "suspend"
              ? ends
                ? fill(m.suspendUntil, { until })
                : m.suspend
              : d.kind === "ban"
                ? m.ban
                : null;
      if (!what) return null;
      const reason = REASONS[text(d.reason)];
      return reason ? `${what} ${fill(m.reason, { reason: s.reasons[reason] })}` : what;
    }
    case "announcement": {
      // Written per language by the admin panel (Phase 10): {"text": {"en": …}, "url": "/…"}.
      const texts = d.text;
      if (typeof texts !== "object" || texts === null) return null;
      const byLocale = texts as Record<string, unknown>;
      return text(byLocale[c.locale]) || text(byLocale.en) || null;
    }
    default:
      return null;
  }
}

/** The page's own paths, in its locale. */
export interface NotificationPaths {
  friends: string;
  profileBase: string;
  play: string;
  profile: string;
  leaderboards: string;
  messages: string;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

/** Where the notification leads, or null. */
export function notificationHref(n: Notification, p: NotificationPaths): string | null {
  const d = n.data;
  const game = text(d.game);
  switch (n.type) {
    case "friend_request":
      return `${p.friends}?tab=requests`;
    case "friend_accepted":
      return n.from ? `${p.profileBase}${encodeURIComponent(n.from.nickname)}/` : p.friends;
    case "invite":
      return SLUG.test(game) && CODE.test(text(d.code))
        ? `${p.play}${game}/?room=${text(d.code)}`
        : null;
    case "message":
      return n.from ? `${p.messages}?with=${n.from.id}` : p.messages;
    case "achievement":
      return p.profile;
    case "rating":
      return SLUG.test(game) && SLUG.test(text(d.pool))
        ? `${p.leaderboards}?board=${game}.rating-${text(d.pool)}`
        : null;
    case "daily":
      return `${p.leaderboards}?board=daily`;
    case "announcement": {
      // Only a path on this site.
      const url = text(d.url);
      return /^\/(?!\/)/.test(url) ? url : null;
    }
    default:
      return null;
  }
}
