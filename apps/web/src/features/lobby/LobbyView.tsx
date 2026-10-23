// The lobby before a match (SPEC §6.4, §10.2, §10.3): seats with people,
// bots and empty places, ready checks, the host's settings and controls, and
// the invite panel. All changes go through the room functions; the view
// re-renders from the live room.
import { Copy, Crown, Lock, QrCode, Share2, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

import type { BotDifficulty } from "@kefche/game-sdk";
import { Button } from "@kefche/ui/components/button";
import { PlayerMarker } from "@kefche/ui/components/player-marker";

import { fill, timerLabel, type TurnStrings } from "@/features/games/turn/labels";
import type { TurnConfig } from "@/features/games/turn/match-setup";
import { Segmented, slot } from "@/features/games/turn/TurnUi";

import { defaultDifficulty } from "./room-match";

import type { RoomSettings } from "./room-settings";
import type { RoomSnapshot } from "./room-store";
import type { RoomStrings } from "./strings";

export interface LobbyActions {
  setReady: (ready: boolean) => void;
  start: () => void;
  leave: () => void;
  /** Host: change the room. */
  update: (
    change: Partial<RoomSettings> & {
      players?: number;
      botSeats?: number[];
      visibility?: "private" | "public";
      allowSpectators?: boolean;
    },
  ) => void;
  lock: (locked: boolean) => void;
  kick: (member: string) => void;
  makeHost: (member: string) => void;
}

interface Props {
  snapshot: RoomSnapshot;
  settings: RoomSettings;
  self: string;
  present: ReadonlySet<string>;
  config: TurnConfig;
  turn: TurnStrings;
  strings: RoomStrings;
  locale: string;
  gameName: string;
  inviteUrl: string;
  busy: boolean;
  error: string | null;
  actions: LobbyActions;
}

export function LobbyView({
  snapshot,
  settings,
  self,
  present,
  config,
  turn: ts,
  strings: s,
  locale,
  gameName,
  inviteUrl,
  busy,
  error,
  actions,
}: Props) {
  const { room, members } = snapshot;
  const isHost = room.host_id === self;
  const me = members.find((m) => m.userId === self && m.status === "joined");
  const seated = (seat: number) =>
    members.find((m) => m.seat === seat && (m.status === "joined" || m.status === "left"));
  const spectators = members.filter((m) => m.role === "spectator" && m.status === "joined").length;
  const seats = Array.from({ length: room.players }, (_, i) => i);
  const everyoneReady = members.every(
    (m) => m.role !== "player" || m.status !== "joined" || m.ready || m.userId === room.host_id,
  );
  const emptySeat = seats.some((i) => !room.bot_seats.includes(i) && !seated(i));
  const difficulty = (seat: number): BotDifficulty =>
    settings.bots[String(seat)] ?? defaultDifficulty(config);
  const counts = Array.from(
    { length: config.players.max - Math.max(config.players.min, 2) + 1 },
    (_, i) => Math.max(config.players.min, 2) + i,
  );

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <Invite code={room.code} url={inviteUrl} gameName={gameName} strings={s} />

      <section className="grid gap-3" aria-labelledby="seats-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="seats-heading" className="text-xl">
            {s.seats}
          </h2>
          {spectators > 0 && (
            <p className="text-sm text-muted">
              {fill(s.watching, { count: spectators.toLocaleString(locale) })}
            </p>
          )}
        </div>
        <ol className="grid gap-2">
          {seats.map((seat) => {
            const member = seated(seat);
            const bot = room.bot_seats.includes(seat);
            const away = member ? !present.has(member.userId) || member.status === "left" : false;
            const name = member
              ? (member.nickname ?? "?")
              : bot
                ? `${s.seatBot} · ${ts.difficulties[difficulty(seat)]}`
                : s.seatEmpty;
            return (
              <li key={seat} className="grid gap-2 rounded-xl border border-border bg-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <PlayerMarker player={slot(seat)} className="size-8" />
                  <span className={`font-semibold ${member || bot ? "" : "text-muted"}`}>
                    {name}
                  </span>
                  {member?.userId === self && <span className="text-sm text-muted">({s.you})</span>}
                  {member?.userId === room.host_id && (
                    <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold">
                      <Crown aria-hidden="true" className="size-3.5" />
                      {s.host}
                    </span>
                  )}
                  {member && member.userId !== room.host_id && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${member.ready ? "bg-success text-on-brand" : "bg-surface-2 text-muted"}`}
                    >
                      {member.ready ? s.ready : s.notReady}
                    </span>
                  )}
                  {member && away && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-warning">
                      <WifiOff aria-hidden="true" className="size-3.5" />
                      {s.away}
                    </span>
                  )}
                </div>
                {isHost && bot && config.difficulties.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                    <Segmented
                      legend={`${s.seatBot} ${String(seat + 1)}`}
                      hideLegend
                      value={difficulty(seat)}
                      options={config.difficulties.map((d) => ({
                        value: d,
                        label: ts.difficulties[d],
                      }))}
                      onChange={(d) => {
                        actions.update({ bots: { ...settings.bots, [String(seat)]: d } });
                      }}
                    />
                    <Button
                      variant="outline"
                      size="md"
                      disabled={busy}
                      onClick={() => {
                        actions.update({ botSeats: room.bot_seats.filter((b) => b !== seat) });
                      }}
                    >
                      {s.openSeat}
                    </Button>
                  </div>
                )}
                {isHost && !bot && !member && config.difficulties.length > 0 && (
                  <Button
                    variant="outline"
                    size="md"
                    className="justify-self-start"
                    disabled={busy}
                    onClick={() => {
                      actions.update({ botSeats: [...room.bot_seats, seat] });
                    }}
                  >
                    {s.makeBot}
                  </Button>
                )}
                {isHost && member && member.userId !== self && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="md"
                      disabled={busy}
                      onClick={() => {
                        actions.makeHost(member.userId);
                      }}
                    >
                      {fill(s.makeHost, { name: member.nickname ?? "?" })}
                    </Button>
                    <Button
                      variant="ghost"
                      size="md"
                      disabled={busy}
                      onClick={() => {
                        actions.kick(member.userId);
                      }}
                    >
                      {fill(s.kick, { name: member.nickname ?? "?" })}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section
        className="grid gap-4 rounded-2xl border border-border bg-surface p-4"
        aria-labelledby="settings-heading"
      >
        <h2 id="settings-heading" className="text-xl">
          {s.settings}
        </h2>
        {isHost ? (
          <>
            {counts.length > 1 && (
              <Segmented
                legend={ts.players}
                value={room.players}
                options={counts.map((n) => ({ value: n, label: n.toLocaleString(locale) }))}
                onChange={(players) => {
                  actions.update({ players, botSeats: room.bot_seats.filter((b) => b < players) });
                }}
              />
            )}
            {config.timers.length > 1 && (
              <Segmented
                legend={ts.timer}
                value={settings.timer}
                options={config.timers.map((preset, i) => ({
                  value: i,
                  label: timerLabel(preset, ts, locale),
                }))}
                onChange={(timer) => {
                  actions.update({ timer });
                }}
              />
            )}
            <Segmented
              legend={s.visibility}
              value={room.visibility === "public" ? "public" : "private"}
              options={[
                { value: "private", label: s.private },
                { value: "public", label: s.public },
              ]}
              onChange={(visibility) => {
                actions.update({ visibility });
              }}
            />
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <label className="flex min-h-11 items-center gap-3 font-semibold">
                <input
                  type="checkbox"
                  className="size-5 accent-brand"
                  checked={room.allow_spectators}
                  onChange={(e) => {
                    actions.update({ allowSpectators: e.target.checked });
                  }}
                />
                {s.allowSpectators}
              </label>
              <label className="flex min-h-11 items-center gap-3 font-semibold">
                <input
                  type="checkbox"
                  className="size-5 accent-brand"
                  checked={room.locked}
                  onChange={(e) => {
                    actions.lock(e.target.checked);
                  }}
                />
                {s.lock}
              </label>
            </div>
          </>
        ) : (
          <ul className="grid gap-1 text-sm">
            <li>
              {ts.players}: {room.players.toLocaleString(locale)}
            </li>
            <li>
              {ts.timer}:{" "}
              {timerLabel(config.timers[settings.timer] ?? { kind: "none" }, ts, locale)}
            </li>
            <li>{room.visibility === "public" ? s.public : s.private}</li>
          </ul>
        )}
        {room.locked && (
          <p className="flex items-center gap-2 text-sm font-semibold text-muted">
            <Lock aria-hidden="true" className="size-4" />
            {s.locked}
          </p>
        )}
      </section>

      {error && (
        <p role="alert" className="font-semibold text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {isHost ? (
          <Button size="lg" disabled={busy || !everyoneReady || emptySeat} onClick={actions.start}>
            {s.start}
          </Button>
        ) : (
          me?.role === "player" && (
            <Button
              size="lg"
              variant={me.ready ? "outline" : "primary"}
              disabled={busy}
              onClick={() => {
                actions.setReady(!me.ready);
              }}
            >
              {me.ready ? s.unsetReady : s.setReady}
            </Button>
          )
        )}
        <Button size="lg" variant="ghost" disabled={busy} onClick={actions.leave}>
          {s.leave}
        </Button>
      </div>
      {isHost && (!everyoneReady || emptySeat) && (
        <p className="text-sm text-muted">{emptySeat ? s.errors.seats_empty : s.startHint}</p>
      )}
      {me?.role === "spectator" && <p className="text-sm text-muted">{s.spectating}</p>}
    </div>
  );
}

function Invite({
  code,
  url,
  gameName,
  strings: s,
}: {
  code: string;
  url: string;
  gameName: string;
  strings: RoomStrings;
}) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    if (!showQr || qr) return;
    // The QR encoder loads only when someone asks for the code. The short
    // link (/r/CODE) makes a smaller code that scans more easily.
    import("uqr").then(
      ({ renderSVG }) => {
        setQr(renderSVG(new URL(`/r/${code}`, url).href, { border: 2 }));
      },
      // Offline or a stale chunk: the code and the link still work.
      () => {
        setShowQr(false);
      },
    );
  }, [showQr, qr, url, code]);

  return (
    <section
      className="grid gap-3 rounded-2xl border border-border bg-surface p-4"
      aria-label={s.code}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm font-semibold text-muted">{s.code}</p>
        <p className="font-mono text-3xl font-bold tracking-[0.2em]">{code}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => {
                setCopied(false);
              }, 2000);
            });
          }}
        >
          <Copy aria-hidden="true" />
          {copied ? s.copied : s.copyLink}
        </Button>
        {canShare && (
          <Button
            variant="outline"
            onClick={() => {
              void navigator
                .share({ title: gameName, text: fill(s.shareText, { game: gameName }), url })
                .catch(() => undefined);
            }}
          >
            <Share2 aria-hidden="true" />
            {s.share}
          </Button>
        )}
        <Button
          variant="outline"
          aria-expanded={showQr}
          onClick={() => {
            setShowQr(!showQr);
          }}
        >
          <QrCode aria-hidden="true" />
          {showQr ? s.hideQr : s.showQr}
        </Button>
      </div>
      <p role="status" className="sr-only">
        {copied ? s.copied : ""}
      </p>
      {showQr && qr && (
        <img
          src={`data:image/svg+xml;utf8,${encodeURIComponent(qr)}`}
          alt={s.qrLabel}
          width="200"
          height="200"
          className="rounded-lg bg-white p-2"
        />
      )}
    </section>
  );
}
