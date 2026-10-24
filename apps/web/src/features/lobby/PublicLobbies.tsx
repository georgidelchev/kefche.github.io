// The public lobby browser on /[locale]/play/ (Phase 5 step 8): open public
// rooms, live, filterable by game (?game=<id>, kept in the address so a
// language switch keeps it). Joining goes through the room page, which
// creates a guest identity only then.
import { LoaderCircle, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@kefche/ui/components/badge";
import { buttonVariants } from "@kefche/ui/components/button";

import { getSupabase } from "@/lib/supabase/client";

import { watchPublicRooms, type PublicRoom } from "./lobby-list";

import type { LobbyBrowserStrings } from "./strings";

export interface LobbyGame {
  id: string;
  name: string;
  thumbnail: string;
  /** The game's room page, /[locale]/play/<id>/. */
  href: string;
}

interface Props {
  games: LobbyGame[];
  locale: string;
  strings: LobbyBrowserStrings;
}

function gameFromUrl(games: LobbyGame[]): string | null {
  const id = new URLSearchParams(location.search).get("game");
  return games.some((g) => g.id === id) ? id : null;
}

// "now", "3 minutes ago", in the page's language.
function since(time: number, now: number, format: Intl.RelativeTimeFormat): string {
  const minutes = Math.round((time - now) / 60_000);
  if (minutes >= 0) return format.format(0, "second");
  return minutes > -60
    ? format.format(minutes, "minute")
    : format.format(Math.round(minutes / 60), "hour");
}

export function PublicLobbies({ games, locale, strings: s }: Props) {
  const [filter, setFilter] = useState(() => gameFromUrl(games));
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const pending = getSupabase();
    if (!pending) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    void pending.then((supabase) => {
      if (cancelled) return;
      stop = watchPublicRooms(
        supabase,
        (list) => {
          setRooms(list);
          setFailed(false);
          setNow(Date.now());
        },
        () => {
          setFailed(true);
        },
      );
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  // Keeps "3 minutes ago" current.
  useEffect(() => {
    const tick = setInterval(() => {
      setNow(Date.now());
    }, 30_000);
    return () => {
      clearInterval(tick);
    };
  }, []);

  function choose(id: string | null) {
    setFilter(id);
    const url = new URL(location.href);
    if (id) url.searchParams.set("game", id);
    else url.searchParams.delete("game");
    history.replaceState(history.state, "", url);
  }

  if (!getSupabase()) return <p className="text-muted">{s.unavailable}</p>;

  const byId = new Map(games.map((g) => [g.id, g]));
  const selected = filter ? byId.get(filter) : undefined;
  // Rooms of games this build doesn't have (an older or newer deploy) are left out.
  const shown = (rooms ?? []).filter((r) => byId.has(r.gameId) && (!filter || r.gameId === filter));
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const chip =
    "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors motion-reduce:transition-none";

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="group" aria-label={s.filter} className="flex flex-wrap gap-2">
          {[null, ...games.map((g) => g.id)].map((id) => (
            <button
              key={id ?? "all"}
              type="button"
              aria-pressed={filter === id}
              onClick={() => {
                choose(id);
              }}
              className={`${chip} ${
                filter === id
                  ? "border-brand bg-brand text-on-brand"
                  : "border-border bg-surface hover:border-border-strong"
              }`}
            >
              {id ? (byId.get(id)?.name ?? id) : s.allGames}
            </button>
          ))}
        </div>
        {selected && (
          <a
            href={`${selected.href}?new=public`}
            className={buttonVariants({ variant: "primary" })}
          >
            <Plus aria-hidden="true" className="size-4" />
            {s.create}
          </a>
        )}
      </div>

      {failed && (
        <p role="alert" className="text-danger">
          {s.failed}
        </p>
      )}

      {rooms === null ? (
        !failed && (
          <p className="flex items-center gap-2 text-muted">
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
            {s.loading}
          </p>
        )
      ) : shown.length === 0 ? (
        <div className="grid justify-items-start gap-2 rounded-2xl border border-dashed border-border p-6">
          <p className="text-lg font-semibold">{s.empty}</p>
          <p className="text-muted">{selected ? s.emptyCreate : s.emptyPick}</p>
        </div>
      ) : (
        <ul className="grid gap-3" aria-label={s.listLabel}>
          {shown.map((room) => {
            const game = byId.get(room.gameId);
            if (!game) return null;
            const canSit = !room.playing && room.taken < room.seats;
            return (
              <li
                key={room.code}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-border bg-surface p-3"
              >
                {/* Decorative: the game's name is next to it. */}
                <img
                  src={game.thumbnail}
                  alt=""
                  width="64"
                  height="48"
                  loading="lazy"
                  className="h-12 w-16 shrink-0 rounded-lg"
                />
                <div id={`lobby-${room.code}`} className="grid min-w-0 flex-1 gap-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold">{game.name}</span>
                    <Badge variant={room.playing ? "neutral" : "accent"}>
                      {room.playing ? s.playing : s.waiting}
                    </Badge>
                  </p>
                  <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
                    {room.host && <span>{s.host.replace("{name}", room.host)}</span>}
                    <span className="tabular-nums">
                      {s.seats
                        .replace("{taken}", String(room.taken))
                        .replace("{total}", String(room.seats))}
                    </span>
                    <span>{since(room.createdAt, now, format)}</span>
                  </p>
                </div>
                <a
                  href={`${game.href}?room=${room.code}`}
                  rel="nofollow"
                  // Every row has a Join or Watch: say which room it is.
                  aria-describedby={`lobby-${room.code}`}
                  className={buttonVariants({ variant: canSit ? "primary" : "outline" })}
                >
                  {canSit ? s.join : s.watch}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
