// The Games section (SPEC §14, Phase 10 step 6), for admins: each game's
// settings (on or off, badges, place in the catalog) applied without a
// deploy (Q2), its numbers and open arenas, and the open rooms, which an
// admin can close. Every change goes through an audited RPC.
import { DoorOpen } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Badge } from "@kefche/ui/components/badge";
import { Button } from "@kefche/ui/components/button";
import { Input } from "@kefche/ui/components/input";
import { EmptyState } from "@kefche/ui/components/states";

import { fill } from "@/features/auth/strings";
import type { Supabase } from "@/lib/supabase/client";

import { ConfirmDialog } from "./ConfirmDialog";
import {
  closeRoom,
  defaultSetting,
  fetchArenas,
  fetchGames,
  fetchRooms,
  gameFromUrl,
  saveGame,
  type ArenaStatus,
  type GamesData,
  type LiveRoom,
  type Setting,
  type Stats,
} from "./games-data";
import { playerPage } from "./links";
import { errorText } from "./PlayerActions";
import { byLabel, dateTime, Field, linkClass, selectClass } from "./ui";

import type { GamesStrings, PlayersStrings } from "../strings";
import type { AdminViewProps } from "../views";

type Props = AdminViewProps & { strings: GamesStrings; players: PlayersStrings };
type Outcome = { ok: boolean; text: string } | null;

export function GamesAdmin(props: Props) {
  const { strings: s } = props;
  return (
    <div className="grid gap-10">
      <section aria-labelledby="games-list" className="grid gap-4">
        <div className="grid gap-1">
          <h2 id="games-list" className="text-xl">
            {s.settingsTitle}
          </h2>
          <p className="text-muted">{s.settingsBody}</p>
        </div>
        <GameList {...props} />
      </section>
      <section aria-labelledby="games-rooms" className="grid gap-4">
        <h2 id="games-rooms" className="text-xl">
          {s.roomsTitle}
        </h2>
        <Rooms {...props} />
      </section>
    </div>
  );
}

const loadGames = (supabase: Supabase) => fetchGames(supabase);

function GameList({ supabase, bcp47, paths, strings: s, players }: Props) {
  const [data, setData] = useState<GamesData | null | "failed">(null);
  const [arenas, setArenas] = useState<ArenaStatus | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const games = byLabel(players.games, bcp47);

  useEffect(() => {
    void loadGames(supabase).then((next) => {
      setData(next ?? "failed");
    });
    void fetchArenas(paths.arena).then(setArenas);
  }, [supabase, paths.arena]);

  async function save(setting: Setting, name: string) {
    setOutcome(null);
    const error = await saveGame(supabase, setting);
    const next = await loadGames(supabase);
    if (next) setData(next);
    setOutcome(
      error === null
        ? { ok: true, text: fill(s.saved, { game: name }) }
        : { ok: false, text: errorText(error, players.act) },
    );
  }

  if (data === null)
    return (
      <p className="text-muted" aria-busy="true">
        {s.loading}
      </p>
    );
  if (data === "failed")
    return (
      <div className="grid justify-items-start gap-3">
        <p role="alert">{s.failed}</p>
        <Button
          variant="outline"
          onClick={() => {
            setData(null);
            void loadGames(supabase).then((next) => {
              setData(next ?? "failed");
            });
          }}
        >
          {s.retry}
        </Button>
      </div>
    );
  return (
    <div className="grid gap-3">
      <p
        role="status"
        className={outcome?.ok === false ? "font-semibold text-danger" : "text-muted empty:hidden"}
      >
        {outcome?.text ?? ""}
      </p>
      <ul className="grid gap-3 lg:grid-cols-2">
        {games.map(([id, name]) => (
          <li key={id}>
            <GameItem
              id={id}
              name={name}
              setting={data.settings.get(id) ?? defaultSetting(id)}
              stats={data.stats.get(id)}
              arena={arenas?.[id]}
              bcp47={bcp47}
              strings={s}
              onSave={(setting) => save(setting, name)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

const FLAGS = ["enabled", "featured", "is_new", "hot", "beta"] as const;

function GameItem({
  id: gameId,
  name,
  setting,
  stats,
  arena,
  bcp47,
  strings: s,
  onSave,
}: {
  id: string;
  name: string;
  setting: Setting;
  stats: Stats | undefined;
  arena: { arenas: number; people: number } | undefined;
  bcp47: string;
  strings: GamesStrings;
  onSave: (setting: Setting) => Promise<void>;
}) {
  const id = useId();
  const [draft, setDraft] = useState(setting);
  const [position, setPosition] = useState(
    setting.position === null ? "" : String(setting.position),
  );
  const [busy, setBusy] = useState(false);
  const number = (value: number) => value.toLocaleString(bcp47);
  const place = position.trim() === "" ? null : Number(position);
  const validPlace = place === null || (Number.isInteger(place) && place >= 1 && place <= 999);
  const changed = FLAGS.some((flag) => draft[flag] !== setting[flag]) || place !== setting.position;

  const facts: [string, string][] = [
    [s.matchesDay, number(stats?.matches_day ?? 0)],
    [s.matchesWeek, number(stats?.matches_week ?? 0)],
    [s.matchesAll, number(stats?.matches_all ?? 0)],
    [s.playersWeek, number(stats?.players_week ?? 0)],
    [s.inReview, number(stats?.in_review ?? 0)],
    [s.openRooms, number(stats?.open_rooms ?? 0)],
  ];
  if (arena)
    facts.push([
      s.arenas,
      fill(s.arenasValue, { arenas: number(arena.arenas), people: number(arena.people) }),
    ]);

  return (
    <article
      aria-labelledby={`${id}-name`}
      className="grid gap-4 rounded-2xl border border-border bg-surface p-4"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 id={`${id}-name`} className="text-lg">
          {name}
        </h3>
        <code className="text-sm text-muted">{gameId}</code>
        {!setting.enabled && <Badge variant="accent">{s.off}</Badge>}
      </header>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label} className="grid gap-0.5">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <form
        aria-label={fill(s.settingsOf, { game: name })}
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!validPlace) return;
          setBusy(true);
          void onSave({ ...draft, position: place }).finally(() => {
            setBusy(false);
          });
        }}
      >
        <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
          <legend className="sr-only">{fill(s.settingsOf, { game: name })}</legend>
          {FLAGS.map((flag) => (
            <label key={flag} className="flex min-h-11 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={draft[flag]}
                onChange={(e) => {
                  const on = e.currentTarget.checked;
                  setDraft((current) => ({ ...current, [flag]: on }));
                }}
                className="size-5 cursor-pointer accent-brand"
              />
              {s.flags[flag]}
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Field id={`${id}-position`} label={s.position} hint={s.positionHint}>
              <Input
                id={`${id}-position`}
                inputMode="numeric"
                value={position}
                aria-invalid={!validPlace}
                aria-describedby={`${id}-position-hint`}
                onChange={(e) => {
                  setPosition(e.currentTarget.value);
                }}
              />
            </Field>
          </div>
          <Button
            type="submit"
            variant={draft.enabled ? "primary" : "danger"}
            disabled={busy || !changed || !validPlace}
            aria-label={fill(s.saveLabel, { game: name })}
          >
            {s.save}
          </Button>
        </div>
        {!draft.enabled && setting.enabled && <p className="text-sm text-muted">{s.offNote}</p>}
      </form>
    </article>
  );
}

function Rooms({ supabase, bcp47, paths, strings: s, players }: Props) {
  const id = useId();
  const names = players.games;
  const [game] = useState(() => gameFromUrl(location.search, Object.keys(names)));
  const [rooms, setRooms] = useState<LiveRoom[] | null | "failed">(null);
  const [pending, setPending] = useState<LiveRoom | null>(null);
  const [opened, setOpened] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const playerHref = playerPage(paths);

  useEffect(() => {
    void fetchRooms(supabase, game).then((next) => {
      setRooms(next ?? "failed");
    });
  }, [supabase, game]);

  async function close(room: LiveRoom) {
    const error = await closeRoom(supabase, room);
    setRooms((await fetchRooms(supabase, game)) ?? "failed");
    setPending(null);
    setOutcome(
      error === null
        ? { ok: true, text: fill(s.closed, { code: room.code }) }
        : {
            ok: false,
            text: error === "not_found" ? s.alreadyClosed : errorText(error, players.act),
          },
    );
  }

  return (
    <div className="grid gap-4">
      <form
        method="get"
        action={paths.games}
        aria-label={s.roomsTitle}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4"
      >
        <div className="min-w-56 flex-1 sm:flex-none">
          <Field id={`${id}-game`} label={s.game}>
            <select id={`${id}-game`} name="game" defaultValue={game ?? ""} className={selectClass}>
              <option value="">{s.anyGame}</option>
              {byLabel(names, bcp47).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Button type="submit">{s.show}</Button>
      </form>
      <p
        role="status"
        className={outcome?.ok === false ? "font-semibold text-danger" : "text-muted empty:hidden"}
      >
        {outcome?.text ?? ""}
      </p>
      {rooms === null && (
        <p className="text-muted" aria-busy="true">
          {s.loading}
        </p>
      )}
      {rooms === "failed" && <p role="alert">{s.failed}</p>}
      {Array.isArray(rooms) &&
        (rooms.length === 0 ? (
          <EmptyState icon={<DoorOpen />} title={s.noRooms} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {rooms.map((room) => (
              <li
                key={room.id}
                className="grid gap-2 rounded-2xl border border-border bg-surface p-4"
              >
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono font-semibold tracking-widest">{room.code}</span>
                  <span>{names[room.game_id] ?? room.game_id}</span>
                  <Badge>{room.status === "playing" ? s.playing : s.lobby}</Badge>
                  <Badge>{room.visibility === "public" ? s.public : s.private}</Badge>
                  {room.rated && <Badge variant="accent">{s.rated}</Badge>}
                </p>
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  <span>
                    {fill(s.playersValue, {
                      count: room.players.toLocaleString(bcp47),
                      seats: room.seats.toLocaleString(bcp47),
                    })}
                  </span>
                  <span>
                    {fill(s.spectatorsValue, { count: room.spectators.toLocaleString(bcp47) })}
                  </span>
                  <span>
                    {s.host}{" "}
                    {room.host_id === null ? (
                      players.noProfile
                    ) : (
                      <a href={playerHref(room.host_id)} className={linkClass}>
                        {room.host_nickname ?? players.noNickname}
                      </a>
                    )}
                  </span>
                  <time dateTime={room.created_at}>{dateTime(room.created_at, bcp47)}</time>
                </p>
                <div>
                  <Button
                    variant="outline"
                    aria-label={fill(s.closeLabel, { code: room.code })}
                    onClick={() => {
                      setOutcome(null);
                      setOpened((n) => n + 1);
                      setPending(room);
                    }}
                  >
                    {s.close}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ))}
      {pending !== null && (
        <ConfirmDialog
          key={opened}
          title={fill(s.closeTitle, { code: pending.code })}
          body={s.closeBody}
          confirm={s.closeRoom}
          danger
          strings={players.act}
          onClose={() => {
            setPending(null);
          }}
          onConfirm={() => close(pending)}
        />
      )}
    </div>
  );
}
