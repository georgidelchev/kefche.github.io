// The notifications page (SPEC §8.4): the player's notifications, newest
// first, older ones a page at a time. Opening it reads them all (the bell
// goes to 0), and the ones that were unread keep a "New" mark while it's
// open. New ones arrive live, already read. Each leads to what it's about.
import {
  Bell,
  CalendarCheck,
  Gamepad2,
  Megaphone,
  MessageCircle,
  ShieldAlert,
  TrendingUp,
  Trophy,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { UserAvatar } from "@kefche/ui/components/avatar";
import { Button } from "@kefche/ui/components/button";
import { isAvatarFrame } from "@kefche/ui/lib/frames";

import { avatarUrl } from "@/features/account/avatar-url";
import { LIVE_EVENT, LIVE_RESUME_EVENT, UNREAD_EVENT } from "@/features/live/presence-context";
import { useAccount } from "@/features/settings/use-account";
import type { Supabase } from "@/lib/supabase/client";
import { supabaseConfig } from "@/lib/supabase/config";

import {
  fetchNotifications,
  notificationHref,
  notificationSchema,
  notificationText,
  readNotifications,
  type NamingContext,
  type Notification,
  type NotificationPaths,
} from "./notifications-data";

import type { NotificationsPageStrings } from "./strings";

const ICONS: Record<string, LucideIcon> = {
  friend_request: UserPlus,
  friend_accepted: UserCheck,
  invite: Gamepad2,
  message: MessageCircle,
  achievement: Trophy,
  rating: TrendingUp,
  daily: CalendarCheck,
  moderation: ShieldAlert,
  announcement: Megaphone,
};

interface Props {
  strings: NotificationsPageStrings;
  naming: NamingContext;
  paths: NotificationPaths;
  signInPath: string;
}

/** The bell and every other listener learn the new count. */
const announceUnread = (count: number) => {
  document.dispatchEvent(new CustomEvent(UNREAD_EVENT, { detail: { count } }));
};

/** Reads them all on the server; the count left (0, unless one arrived meanwhile). */
async function readAll(supabase: Supabase) {
  const left = await readNotifications(supabase);
  if (left !== null) announceUnread(left);
}

export function NotificationsPage({ strings: s, naming, paths, signInPath }: Props) {
  const account = useAccount(signInPath);
  const [items, setItems] = useState<Notification[] | null | undefined>(undefined);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);

  // The first page, then everything read; again when the tab comes back.
  useEffect(() => {
    if (account.status !== "ready") return;
    const { supabase } = account;
    const load = () => {
      void fetchNotifications(supabase, null).then((page) => {
        setItems(page?.items ?? null);
        setMore(page !== null && page.items.length > 0 && page.items.length >= 30);
        if (page && page.unread > 0) void readAll(supabase);
      });
    };
    load();
    // New ones show at the top, and are read since the page is open.
    const live = (event: Event) => {
      const { detail } = event as CustomEvent<{ event?: unknown; payload?: unknown }>;
      if (detail.event !== "notification") return;
      const parsed = notificationSchema.safeParse(detail.payload);
      if (!parsed.success) return;
      const item = parsed.data;
      setItems((current) =>
        current ? [item, ...current.filter((n) => n.id !== item.id)] : current,
      );
      void readNotifications(supabase, [item.id]).then((left) => {
        if (left !== null) announceUnread(left);
      });
    };
    document.addEventListener(LIVE_EVENT, live);
    document.addEventListener(LIVE_RESUME_EVENT, load);
    return () => {
      document.removeEventListener(LIVE_EVENT, live);
      document.removeEventListener(LIVE_RESUME_EVENT, load);
    };
  }, [account]);

  if (account.status === "error" || items === null) {
    return (
      <div className="grid justify-items-start gap-3">
        <p role="alert">{s.failed}</p>
        {account.status === "ready" && (
          <Button
            variant="outline"
            onClick={() => {
              setItems(undefined);
              void fetchNotifications(account.supabase, null).then((page) => {
                setItems(page?.items ?? null);
              });
            }}
          >
            {s.retry}
          </Button>
        )}
      </div>
    );
  }
  if (account.status !== "ready" || items === undefined) {
    return (
      <p className="min-h-32 text-muted" aria-busy="true">
        {s.loading}
      </p>
    );
  }
  const { supabase } = account;

  async function loadOlder() {
    const last = items?.at(-1);
    if (!last || busy) return;
    setBusy(true);
    const page = await fetchNotifications(supabase, last.id);
    setBusy(false);
    if (!page) return;
    setItems((current) => [...(current ?? []), ...page.items]);
    setMore(page.items.length >= 30);
  }

  const shown = items.flatMap((n) => {
    const text = notificationText(n, s, naming);
    return text === null ? [] : [{ n, text, href: notificationHref(n, paths) }];
  });
  if (shown.length === 0) {
    return (
      <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-border p-8 text-center">
        <Bell aria-hidden="true" className="size-8 text-muted" />
        <p className="font-semibold">{s.empty}</p>
        <p className="text-sm text-muted">{s.emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <ul className="grid gap-2">
        {shown.map(({ n, text, href }) => (
          <li key={n.id}>
            <Item
              notification={n}
              text={text}
              href={href}
              naming={naming}
              isNew={!n.read}
              newLabel={s.new}
            />
          </li>
        ))}
      </ul>
      {more && (
        <Button
          variant="outline"
          className="justify-self-center"
          disabled={busy}
          onClick={() => void loadOlder()}
        >
          {s.more}
        </Button>
      )}
    </div>
  );
}

function Item({
  notification: n,
  text,
  href,
  naming,
  isNew,
  newLabel,
}: {
  notification: Notification;
  text: string;
  href: string | null;
  naming: NamingContext;
  isNew: boolean;
  newLabel: string;
}) {
  const Icon = ICONS[n.type] ?? Bell;
  const image =
    n.from && supabaseConfig
      ? avatarUrl(
          {
            avatar_kind: n.from.avatarKind,
            avatar_preset: n.from.avatarPreset,
            avatar_path: n.from.avatarPath,
          },
          supabaseConfig.url,
        )
      : null;
  const when = new Date(n.at).toLocaleString(naming.bcp47, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const body = (
    <>
      {n.from ? (
        <UserAvatar
          name={n.from.nickname}
          id={n.from.id}
          {...(image ? { src: image } : {})}
          frame={isAvatarFrame(n.from.avatarFrame) ? n.from.avatarFrame : null}
        />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2">
          <Icon aria-hidden="true" className="size-5 text-muted" />
        </span>
      )}
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className={isNew ? "font-semibold" : ""}>{text}</span>
        {n.note && <span className="text-sm break-words whitespace-pre-line">{n.note}</span>}
        <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <time dateTime={n.at}>{when}</time>
          {isNew && (
            <span className="rounded-full bg-brand px-2 text-xs font-semibold text-on-brand">
              {newLabel}
            </span>
          )}
        </span>
      </span>
    </>
  );
  const box = `flex items-start gap-3 rounded-2xl border p-3 ${isNew ? "border-brand bg-surface" : "border-border bg-surface"}`;
  return href ? (
    <a
      href={href}
      className={`${box} hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`}
    >
      {body}
    </a>
  ) : (
    <div className={box}>{body}</div>
  );
}
