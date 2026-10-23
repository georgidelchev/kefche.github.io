// An online room for one game (SPEC §10.2), on /[locale]/play/<game>/.
// `?room=CODE` joins that room and `?new` creates one; without either the
// page offers both. A guest identity is created only then, never on page
// load, and a guest picks a nickname first. In the room, the live rows drive
// the lobby and presence on the room's channel shows who is connected.
import { LoaderCircle } from "lucide-react";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";

import type { PresenceState, Transport } from "@kefche/game-sdk";
import { Button } from "@kefche/ui/components/button";

import { ensureIdentity, type Identity } from "@/features/account/identity";
import { FormMessage, TextField } from "@/features/auth/components/fields";
import type { PlayerStrings } from "@/features/games/GamePlayer";
import type { TurnStrings } from "@/features/games/turn/labels";
import type { TurnConfig } from "@/features/games/turn/match-setup";
import { getSupabase, type Supabase } from "@/lib/supabase/client";
import { supabaseConfig } from "@/lib/supabase/config";

import { GuestProfileForm } from "./GuestProfileForm";
import { LobbyView, type LobbyActions } from "./LobbyView";
import { OnlineMatch } from "./OnlineMatch";
import { roomMatch, type RoomMatch } from "./room-match";
import { parseRoomSettings, settingsJson } from "./room-settings";
import { roomErrorCode, watchRoom, type RoomMember, type RoomSnapshot } from "./room-store";
import { createSupabaseTransport } from "./supabase-transport";

import type { GuestStrings, RoomErrorCode, RoomStrings } from "./strings";

export interface OnlineGame {
  id: string;
  version: number;
  name: string;
  config: TurnConfig;
  /** The game's own UI strings (i18n/<locale>.json "ui"). */
  ui: Record<string, string>;
}

/** A change to the room as this browser shows it. */
type Patch = (snapshot: RoomSnapshot) => RoomSnapshot;

interface Props {
  game: OnlineGame;
  locale: string;
  dir: "ltr" | "rtl";
  strings: RoomStrings;
  player: PlayerStrings;
  guest: GuestStrings;
  turn: TurnStrings;
  paths: { game: string; privacy: string; onboarding: string };
}

type Intent = { kind: "create" } | { kind: "join"; code: string };

type Stage =
  | { kind: "choose" }
  | { kind: "working"; intent: Intent }
  | { kind: "profile"; identity: Identity; intent: Intent }
  | { kind: "onboarding" }
  | { kind: "room"; supabase: Supabase; identity: Identity; roomId: string; code: string }
  | { kind: "gone"; code: RoomErrorCode };

const CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
const normalizeCode = (raw: string) => raw.trim().toUpperCase().replace(/[\s-]/g, "");

function intentFromUrl(): Intent | null {
  const params = new URLSearchParams(location.search);
  const room = params.get("room");
  if (room !== null) return { kind: "join", code: normalizeCode(room) };
  return params.has("new") ? { kind: "create" } : null;
}

export function OnlineRoom({ game, locale, dir, strings: s, player, guest, turn, paths }: Props) {
  // A link with ?room= or ?new starts at once (the page renders only in the browser).
  const [stage, setStage] = useState<Stage>(() => {
    const intent = intentFromUrl();
    return intent ? { kind: "working", intent } : { kind: "choose" };
  });
  const [error, setError] = useState<string | null>(null);

  function begin(intent: Intent) {
    setError(null);
    setStage({ kind: "working", intent });
    void perform(intent);
  }

  async function perform(intent: Intent) {
    const pending = getSupabase();
    if (!pending) return;
    try {
      const supabase = await pending;
      if (intent.kind === "join" && !CODE.test(intent.code)) throw new Error("room_not_found");
      const identity = await ensureIdentity(supabase);
      if (identity.nickname === null) {
        setStage(identity.guest ? { kind: "profile", identity, intent } : { kind: "onboarding" });
        return;
      }
      let code = intent.kind === "join" ? intent.code : null;
      if (intent.kind === "create") {
        const players = Math.max(game.config.players.default, 2, game.config.players.min);
        const { data, error: rpcError } = await supabase.rpc("create_room", {
          p_game_id: game.id,
          p_game_version: game.version,
          p_players: players,
          p_settings: settingsJson({ timer: 0, bots: {}, seed: null }),
        });
        if (rpcError) throw rpcError;
        code = data.code;
      }
      const { data: room, error: joinError } = await supabase.rpc("join_room", {
        p_code: code ?? "",
      });
      if (joinError) throw joinError;
      // The address becomes the invite link, so a reload rejoins instead of creating again.
      history.replaceState(history.state, "", `${location.pathname}?room=${room.code}`);
      setStage({ kind: "room", supabase, identity, roomId: room.id, code: room.code });
    } catch (e) {
      setError(s.errors[roomErrorCode(e)]);
      setStage({ kind: "choose" });
    }
  }

  // Once, for the address the page opened with.
  const startFromUrl = useEffectEvent(() => {
    if (stage.kind === "working") void perform(stage.intent);
  });
  useEffect(() => {
    startFromUrl();
  }, []);

  if (!getSupabase()) return <p className="text-muted">{s.signedOut}</p>;

  switch (stage.kind) {
    case "choose":
      return <Choose strings={s} error={error} onRun={begin} />;
    case "working":
      return <Waiting label={stage.intent.kind === "create" ? s.creating : s.joining} />;
    case "profile":
      return (
        <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-surface p-5">
          <GuestProfileForm
            strings={guest}
            privacyHref={paths.privacy}
            needsNickname
            needsAge={false}
            onDone={() => {
              begin(stage.intent);
            }}
          />
        </div>
      );
    case "onboarding":
      return (
        <div className="grid justify-items-start gap-3">
          <p>{s.onboarding}</p>
          <a
            href={paths.onboarding}
            className="font-semibold text-link underline-offset-4 hover:underline"
          >
            {s.onboardingLink}
          </a>
        </div>
      );
    case "gone":
      return (
        <div className="grid justify-items-start gap-3">
          <p role="alert" className="text-lg font-semibold">
            {s.errors[stage.code]}
          </p>
          <a
            href={paths.game}
            className="font-semibold text-link underline-offset-4 hover:underline"
          >
            {s.backToGame}
          </a>
        </div>
      );
    case "room":
      return (
        <Room
          key={stage.roomId}
          {...stage}
          game={game}
          locale={locale}
          dir={dir}
          strings={s}
          player={player}
          turn={turn}
          onGone={(code) => {
            history.replaceState(history.state, "", location.pathname);
            setStage({ kind: "gone", code });
          }}
          onLeft={() => {
            location.assign(paths.game);
          }}
        />
      );
  }
}

function Choose({
  strings: s,
  error,
  onRun,
}: {
  strings: RoomStrings;
  error: string | null;
  onRun: (intent: Intent) => void;
}) {
  const id = useId();
  const [code, setCode] = useState("");
  return (
    <div className="grid gap-6">
      <Button
        size="lg"
        className="justify-self-start"
        onClick={() => {
          onRun({ kind: "create" });
        }}
      >
        {s.create}
      </Button>
      <form
        className="grid max-w-sm gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onRun({ kind: "join", code: normalizeCode(code) });
        }}
      >
        <h2 className="text-xl">{s.joinTitle}</h2>
        <TextField
          id={`${id}-code`}
          label={s.codeLabel}
          hint={s.codeHint}
          value={code}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
          maxLength={8}
          className="font-mono tracking-[0.2em] uppercase"
          onChange={(e) => {
            setCode(e.target.value);
          }}
        />
        <Button type="submit" variant="outline" className="justify-self-start">
          {s.joinSubmit}
        </Button>
      </form>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </div>
  );
}

interface RoomProps {
  supabase: Supabase;
  identity: Identity;
  roomId: string;
  code: string;
  game: OnlineGame;
  locale: string;
  dir: "ltr" | "rtl";
  strings: RoomStrings;
  player: PlayerStrings;
  turn: TurnStrings;
  onGone: (code: RoomErrorCode) => void;
  onLeft: () => void;
}

// last_seen_at: a player silent for 5 minutes counts as gone, and a room
// without players is deleted.
const HEARTBEAT_MS = 60_000;

function Room({
  supabase,
  identity,
  roomId,
  code,
  game,
  locale,
  dir,
  strings: s,
  player,
  turn,
  onGone,
  onLeft,
}: RoomProps) {
  const self = identity.userId;
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [present, setPresent] = useState<ReadonlySet<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transport, setTransport] = useState<Transport | null>(null);
  const [match, setMatch] = useState<(RoomMatch & { seed: string; countdown: boolean }) | null>(
    null,
  );
  // Changes this member made that the room hasn't confirmed yet, shown at once.
  const [pending, setPending] = useState<readonly Patch[]>([]);
  const seenRef = useRef(false);
  const refreshRef = useRef<(() => Promise<void>) | null>(null);
  const gone = useEffectEvent(onGone);

  // The live room. A deleted room lost its last player; a member missing
  // from it, or marked kicked, was removed.
  useEffect(() => {
    // The match is built once per seed, when the room starts playing.
    let last: { status: string; seed: string | null } | null = null;
    const watch = watchRoom(
      supabase,
      roomId,
      (next) => {
        if (next === "deleted") {
          gone(seenRef.current ? "room_closed" : "room_not_found");
          return;
        }
        if (next === "removed") {
          gone("room_kicked");
          return;
        }
        const me = next.members.find((m) => m.userId === self);
        if (!me || me.status === "kicked") {
          gone(seenRef.current || me ? "room_kicked" : "room_not_found");
          return;
        }
        seenRef.current = true;
        setError(null);
        setSnapshot(next);
        const settings = parseRoomSettings(next.room.settings);
        const playing = next.room.status === "playing" || next.room.status === "finished";
        const seed = playing ? settings.seed : null;
        if (seed !== (last?.seed ?? null)) {
          setMatch(
            seed === null
              ? null
              : {
                  ...roomMatch(next, { ...settings, seed }, game.config, turn, self),
                  seed,
                  countdown: last?.status === "lobby",
                },
          );
        }
        last = { status: next.room.status, seed };
      },
      () => {
        setError(s.errors.connection);
      },
    );
    refreshRef.current = watch.refresh;
    return () => {
      refreshRef.current = null;
      watch.stop();
    };
  }, [supabase, roomId, self, s, game, turn]);

  // The room's channel: presence now, the match's messages later.
  const joinedAt = snapshot?.members.find((m) => m.userId === self)?.joinedAt ?? null;
  useEffect(() => {
    if (joinedAt === null) return;
    const channel = createSupabaseTransport(supabase, { id: roomId, code }, self);
    const presence: PresenceState = { memberId: self, joinedAt };
    const stop = channel.onPresence((roster) => {
      setPresent(new Set(roster.map((p) => p.memberId)));
    });
    // The match starts on a connected transport.
    channel.connect(presence).then(
      () => {
        setTransport(channel);
      },
      () => {
        setError(s.errors.connection);
      },
    );
    return () => {
      stop();
      channel.close();
      setTransport(null);
    };
  }, [supabase, roomId, code, self, joinedAt, s]);

  // Heartbeats keep this member counted as here, also as soon as the page
  // shows again. A closing page says goodbye (a reload is back well within
  // the 15 s grace); it has to go out while the page unloads, so it is a
  // keepalive fetch with the session's token, kept at hand for that.
  useEffect(() => {
    let token: string | null = null;
    void supabase.auth.getSession().then(({ data }) => {
      token = data.session?.access_token ?? null;
    });
    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      token = session?.access_token ?? null;
    });
    const beat = () => void supabase.rpc("room_heartbeat", { p_room: roomId });
    const goodbye = () => {
      if (!token || !supabaseConfig) return;
      fetch(`${supabaseConfig.url}/rest/v1/rpc/room_goodbye`, {
        method: "POST",
        keepalive: true,
        headers: {
          apikey: supabaseConfig.key,
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ p_room: roomId }),
      }).catch(() => undefined);
    };
    const visible = () => {
      if (document.visibilityState === "visible") beat();
    };
    const shown = (event: PageTransitionEvent) => {
      if (event.persisted) beat();
    };
    const timer = setInterval(beat, HEARTBEAT_MS);
    // In case the previous page's goodbye arrived after this page rejoined.
    const settle = setTimeout(beat, 5000);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("pageshow", shown);
    window.addEventListener("pagehide", goodbye);
    return () => {
      clearInterval(timer);
      clearTimeout(settle);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("pageshow", shown);
      window.removeEventListener("pagehide", goodbye);
      auth.subscription.unsubscribe();
    };
  }, [supabase, roomId]);

  if (!snapshot) return <Waiting label={s.joining} />;

  const view = pending.reduce((current, patch) => patch(current), snapshot);
  const { room } = view;
  const settings = parseRoomSettings(room.settings);

  // Shows the change right away, then reads the room as soon as the call
  // returns instead of waiting for Realtime to announce it (about a second).
  // If the call fails, dropping the patch puts the room back. Only a call
  // without a patch (start, leave) disables the buttons while it runs:
  // disabling them for every change made them blink.
  async function call(action: () => PromiseLike<{ error: unknown }>, patch?: Patch) {
    if (patch) setPending((list) => [...list, patch]);
    else setBusy(true);
    setError(null);
    try {
      const { error: rpcError } = await action();
      if (rpcError) setError(s.errors[roomErrorCode(rpcError)]);
    } catch (e) {
      setError(s.errors[roomErrorCode(e)]);
    } finally {
      if (!patch) setBusy(false);
      await refreshRef.current?.();
      if (patch) setPending((list) => list.filter((p) => p !== patch));
    }
  }

  const patchRoom =
    (change: Partial<RoomSnapshot["room"]>): Patch =>
    (current) => ({ ...current, room: { ...current.room, ...change } });
  const patchMember =
    (userId: string, change: Partial<RoomMember>): Patch =>
    (current) => ({
      ...current,
      members: current.members.map((m) => (m.userId === userId ? { ...m, ...change } : m)),
    });

  const actions: LobbyActions = {
    setReady: (ready) =>
      void call(
        () => supabase.rpc("set_ready", { p_room: roomId, p_ready: ready }),
        patchMember(self, { ready }),
      ),
    start: () => void call(() => supabase.rpc("start_room", { p_room: roomId })),
    leave: () => {
      void call(() => supabase.rpc("leave_room", { p_room: roomId })).then(onLeft);
    },
    update: (change) => {
      const next = {
        players: change.players ?? room.players,
        bot_seats: change.botSeats ?? room.bot_seats,
        visibility: change.visibility ?? room.visibility,
        allow_spectators: change.allowSpectators ?? room.allow_spectators,
        settings: settingsJson({
          ...settings,
          ...(change.timer === undefined ? {} : { timer: change.timer }),
          ...(change.bots === undefined ? {} : { bots: change.bots }),
        }),
      };
      void call(
        () =>
          supabase.rpc("update_room", {
            p_room: roomId,
            p_players: next.players,
            p_bot_seats: next.bot_seats,
            p_visibility: next.visibility,
            p_allow_spectators: next.allow_spectators,
            p_settings: next.settings,
          }),
        patchRoom(next),
      );
    },
    lock: (locked) =>
      void call(
        () => supabase.rpc("lock_room", { p_room: roomId, p_locked: locked }),
        patchRoom({ locked }),
      ),
    kick: (member) =>
      void call(
        () => supabase.rpc("kick_member", { p_room: roomId, p_member: member }),
        patchMember(member, { status: "kicked" }),
      ),
    makeHost: (member) =>
      void call(
        () => supabase.rpc("transfer_host", { p_room: roomId, p_member: member }),
        patchRoom({ host_id: member }),
      ),
  };

  if (match) {
    if (!transport) return <Waiting label={s.joining} />;
    const status = (userId: string) => view.members.find((m) => m.userId === userId)?.status;
    return (
      <OnlineMatch
        key={match.seed}
        supabase={supabase}
        transport={transport}
        roomId={roomId}
        self={self}
        host={room.host_id}
        match={match}
        seed={match.seed}
        away={match.seatMembers.map(
          (member) => member !== null && (!present.has(member) || status(member) === "left"),
        )}
        countdown={match.countdown}
        game={game}
        locale={locale}
        dir={dir}
        strings={s}
        player={player}
        turn={turn}
        onLeave={actions.leave}
      />
    );
  }

  return (
    <LobbyView
      snapshot={view}
      settings={settings}
      self={self}
      present={present}
      config={game.config}
      turn={turn}
      strings={s}
      locale={locale}
      gameName={game.name}
      inviteUrl={`${location.origin}${location.pathname}?room=${room.code}`}
      busy={busy}
      error={error}
      actions={actions}
    />
  );
}

function Waiting({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center gap-3 text-lg">
      <LoaderCircle aria-hidden="true" className="size-6 animate-spin motion-reduce:animate-none" />
      {label}
    </p>
  );
}
