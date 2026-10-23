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
import type { TurnStrings } from "@/features/games/turn/labels";
import type { TurnConfig } from "@/features/games/turn/match-setup";
import { getSupabase, type Supabase } from "@/lib/supabase/client";

import { GuestProfileForm } from "./GuestProfileForm";
import { LobbyView, type LobbyActions } from "./LobbyView";
import { parseRoomSettings, settingsJson } from "./room-settings";
import { roomErrorCode, watchRoom, type RoomSnapshot } from "./room-store";
import {
  ROOM_ERROR_CODES,
  type GuestStrings,
  type RoomErrorCode,
  type RoomStrings,
} from "./strings";
import { createSupabaseTransport } from "./supabase-transport";

export interface OnlineGame {
  id: string;
  version: number;
  name: string;
  config: TurnConfig;
}

interface Props {
  game: OnlineGame;
  locale: string;
  strings: RoomStrings;
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

// The room functions' error codes; anything else reads as "unknown".
const errorCode = (error: unknown): RoomErrorCode => {
  const code = roomErrorCode(error);
  return (ROOM_ERROR_CODES as readonly string[]).includes(code)
    ? (code as RoomErrorCode)
    : "unknown";
};

const CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
const normalizeCode = (raw: string) => raw.trim().toUpperCase().replace(/[\s-]/g, "");

function intentFromUrl(): Intent | null {
  const params = new URLSearchParams(location.search);
  const room = params.get("room");
  if (room !== null) return { kind: "join", code: normalizeCode(room) };
  return params.has("new") ? { kind: "create" } : null;
}

export function OnlineRoom({ game, locale, strings: s, guest, turn, paths }: Props) {
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
      setError(s.errors[errorCode(e)]);
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
      return (
        <p role="status" className="flex items-center gap-3 text-lg">
          <LoaderCircle
            aria-hidden="true"
            className="size-6 animate-spin motion-reduce:animate-none"
          />
          {stage.intent.kind === "create" ? s.creating : s.joining}
        </p>
      );
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
          strings={s}
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
  strings: RoomStrings;
  turn: TurnStrings;
  onGone: (code: RoomErrorCode) => void;
  onLeft: () => void;
}

// last_seen_at and the room's idle clock (rooms close after 15 idle minutes).
const HEARTBEAT_MS = 60_000;

function Room({
  supabase,
  identity,
  roomId,
  code,
  game,
  locale,
  strings: s,
  turn,
  onGone,
  onLeft,
}: RoomProps) {
  const self = identity.userId;
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [present, setPresent] = useState<ReadonlySet<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const transportRef = useRef<Transport | null>(null);
  const seenRef = useRef(false);
  const gone = useEffectEvent(onGone);

  // The live room. Reading nothing back means this member was removed.
  useEffect(
    () =>
      watchRoom(
        supabase,
        roomId,
        (next) => {
          const me = next?.members.find((m) => m.userId === self);
          if (!next || !me || me.status === "kicked") {
            gone(seenRef.current || me?.status === "kicked" ? "room_kicked" : "room_not_found");
            return;
          }
          if (next.room.status === "closed") {
            gone("room_closed");
            return;
          }
          seenRef.current = true;
          setError(null);
          setSnapshot(next);
        },
        () => {
          setError(s.errors.connection);
        },
      ),
    [supabase, roomId, self, s],
  );

  // The room's channel: presence now, the match's messages later.
  const joinedAt = snapshot?.members.find((m) => m.userId === self)?.joinedAt ?? null;
  useEffect(() => {
    if (joinedAt === null || transportRef.current) return;
    const transport = createSupabaseTransport(supabase, { id: roomId, code }, self);
    transportRef.current = transport;
    const presence: PresenceState = { memberId: self, joinedAt };
    const stop = transport.onPresence((roster) => {
      setPresent(new Set(roster.map((p) => p.memberId)));
    });
    transport.connect(presence).catch(() => {
      setError(s.errors.connection);
    });
    return () => {
      stop();
      transport.close();
      transportRef.current = null;
    };
  }, [supabase, roomId, code, self, joinedAt, s]);

  useEffect(() => {
    const beat = () => void supabase.rpc("room_heartbeat", { p_room: roomId });
    const timer = setInterval(beat, HEARTBEAT_MS);
    return () => {
      clearInterval(timer);
    };
  }, [supabase, roomId]);

  if (!snapshot) {
    return (
      <p role="status" className="flex items-center gap-3 text-lg">
        <LoaderCircle
          aria-hidden="true"
          className="size-6 animate-spin motion-reduce:animate-none"
        />
        {s.joining}
      </p>
    );
  }

  const { room } = snapshot;
  const settings = parseRoomSettings(room.settings);

  async function call(action: () => PromiseLike<{ error: unknown }>) {
    setBusy(true);
    setError(null);
    try {
      const { error: rpcError } = await action();
      if (rpcError) setError(s.errors[errorCode(rpcError)]);
    } catch (e) {
      setError(s.errors[errorCode(e)]);
    } finally {
      setBusy(false);
    }
  }

  const actions: LobbyActions = {
    setReady: (ready) =>
      void call(() => supabase.rpc("set_ready", { p_room: roomId, p_ready: ready })),
    start: () => void call(() => supabase.rpc("start_room", { p_room: roomId })),
    leave: () => {
      void call(() => supabase.rpc("leave_room", { p_room: roomId })).then(onLeft);
    },
    update: (change) =>
      void call(() =>
        supabase.rpc("update_room", {
          p_room: roomId,
          p_players: change.players ?? room.players,
          p_bot_seats: change.botSeats ?? room.bot_seats,
          p_visibility: change.visibility ?? room.visibility,
          p_allow_spectators: change.allowSpectators ?? room.allow_spectators,
          p_settings: settingsJson({
            ...settings,
            ...(change.timer === undefined ? {} : { timer: change.timer }),
            ...(change.bots === undefined ? {} : { bots: change.bots }),
          }),
        }),
      ),
    lock: (locked) =>
      void call(() => supabase.rpc("lock_room", { p_room: roomId, p_locked: locked })),
    kick: (member) =>
      void call(() => supabase.rpc("kick_member", { p_room: roomId, p_member: member })),
    makeHost: (member) =>
      void call(() => supabase.rpc("transfer_host", { p_room: roomId, p_member: member })),
  };

  return (
    <LobbyView
      snapshot={snapshot}
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
