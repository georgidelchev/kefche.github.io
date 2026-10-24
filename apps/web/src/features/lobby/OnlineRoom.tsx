// An online room for one game (SPEC §10.2), on /[locale]/play/<game>/.
// `?room=CODE` joins that room and `?new` creates one; without either the
// page offers both. A guest identity is created only then, never on page
// load, and a guest picks a nickname first. In the room, the live rows drive
// the lobby and presence on the room's channel shows who is connected.
// `?rated=<clock>` searches for a rated opponent (accounts only), and the
// pairing's room starts at once.
import { LoaderCircle } from "lucide-react";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { PresenceState, Transport } from "@kefche/game-sdk";
import { Button } from "@kefche/ui/components/button";

import { accountIdentity, ensureIdentity, type Identity } from "@/features/account/identity";
import { FormMessage, TextField } from "@/features/auth/components/fields";
import type { PlayerStrings } from "@/features/games/GamePlayer";
import type { RaceSetup, RatedClock } from "@/features/games/page-props";
import { fill, timerLabel, type TurnStrings } from "@/features/games/turn/labels";
import type { TurnConfig } from "@/features/games/turn/match-setup";
import { getSupabase, send, type Supabase } from "@/lib/supabase/client";
import { supabaseConfig } from "@/lib/supabase/config";

import { GuestProfileForm } from "./GuestProfileForm";
import { LobbyView, type LobbyActions } from "./LobbyView";
import { OnlineMatch, RATED_COUNTDOWN_MS } from "./OnlineMatch";
import { RaceMatch } from "./RaceMatch";
import { RatedSearch } from "./RatedSearch";
import { onlineTimer, roomMatch, type RoomMatch } from "./room-match";
import { parseRated, parseRoomSettings, settingsJson } from "./room-settings";
import { roomErrorCode, watchRoom, type RoomMember, type RoomSnapshot } from "./room-store";
import { RoomChat } from "./RoomChat";
import { createSupabaseTransport } from "./supabase-transport";

import type {
  ChatStrings,
  GuestStrings,
  RaceStrings,
  RatedStrings,
  RoomErrorCode,
  RoomStrings,
} from "./strings";

export interface OnlineGame {
  id: string;
  version: number;
  name: string;
  config: TurnConfig;
  /** The game's own UI strings (i18n/<locale>.json "ui"). */
  ui: Record<string, string>;
  /** Online modes beyond invite-only rooms (manifest `online-public`, `quick-match`). */
  modes: { public: boolean; quick: boolean };
  /** Set for race games: the room plays a race instead of a turn-based match. */
  race: RaceSetup | null;
  /** The clocks rated matchmaking offers (none for an unrated game). */
  rated: RatedClock[];
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
  chat: ChatStrings;
  turn: TurnStrings;
  race: RaceStrings;
  paths: { game: string; privacy: string; onboarding: string; signIn: string };
}

type Intent =
  | { kind: "create"; public?: boolean }
  | { kind: "join"; code: string }
  | { kind: "quick" }
  | { kind: "rated"; timer: number };

type Stage =
  | { kind: "choose" }
  | { kind: "working"; intent: Intent }
  | { kind: "profile"; identity: Identity; intent: Intent }
  | { kind: "onboarding" }
  | { kind: "accountsOnly"; timer: number }
  | { kind: "searching"; supabase: Supabase; identity: Identity; timer: number }
  | { kind: "room"; supabase: Supabase; identity: Identity; roomId: string; code: string }
  | { kind: "gone"; code: RoomErrorCode };

const CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
const normalizeCode = (raw: string) => raw.trim().toUpperCase().replace(/[\s-]/g, "");

function intentFromUrl({ modes, rated }: OnlineGame): Intent | null {
  const params = new URLSearchParams(location.search);
  const room = params.get("room");
  if (room !== null) return { kind: "join", code: normalizeCode(room) };
  if (params.has("quick") && modes.quick) return { kind: "quick" };
  const timer = Number(params.get("rated") ?? "-");
  if (rated.some((clock) => clock.timer === timer)) return { kind: "rated", timer };
  // ?new=public (from the lobby browser) lists the new room there.
  return params.has("new")
    ? { kind: "create", public: modes.public && params.get("new") === "public" }
    : null;
}

export function OnlineRoom({
  game,
  locale,
  dir,
  strings: s,
  player,
  guest,
  chat,
  turn,
  race,
  paths,
}: Props) {
  // A link with ?room=, ?quick, ?rated= or ?new[=public] starts at once (the page renders only in the browser).
  const [stage, setStage] = useState<Stage>(() => {
    const intent = intentFromUrl(game);
    return intent ? { kind: "working", intent } : { kind: "choose" };
  });
  const [error, setError] = useState<string | null>(null);
  /** "5 + 3" */
  const clockLabel = (timer: number) =>
    timerLabel(game.config.timers[timer] ?? { kind: "none" }, turn, locale);
  /** "5 + 3 · Blitz" */
  const ratedLabel = (timer: number) => {
    const pool = game.rated.find((clock) => clock.timer === timer)?.pool ?? "";
    return fill(s.rated.clock, { clock: clockLabel(timer), pool: s.rated.pools[pool] ?? pool });
  };

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
      if (intent.kind === "rated") {
        // Accounts only: a guest identity is never created for it.
        const account = await accountIdentity(supabase);
        if (!account) setStage({ kind: "accountsOnly", timer: intent.timer });
        else if (account.nickname === null) setStage({ kind: "onboarding" });
        else {
          // A reload goes on searching.
          history.replaceState(
            history.state,
            "",
            `${location.pathname}?rated=${String(intent.timer)}`,
          );
          setStage({ kind: "searching", supabase, identity: account, timer: intent.timer });
        }
        return;
      }
      const identity = await ensureIdentity(supabase);
      if (identity.nickname === null) {
        setStage(identity.guest ? { kind: "profile", identity, intent } : { kind: "onboarding" });
        return;
      }
      let code = intent.kind === "join" ? intent.code : null;
      const players = Math.max(game.config.players.default, 2, game.config.players.min);
      if (intent.kind === "quick") {
        // A seat in an open public lobby, or a new one (no bots fill seats).
        const { data, error: rpcError } = await supabase.rpc("quick_match", {
          p_game_id: game.id,
          p_game_version: game.version,
          p_players: players,
          p_settings: settingsJson({ timer: game.config.onlineTimers[0] ?? 0, bots: {} }),
        });
        if (rpcError) throw rpcError;
        code = data.code;
      }
      if (intent.kind === "create") {
        const { data, error: rpcError } = await supabase.rpc("create_room", {
          p_game_id: game.id,
          p_game_version: game.version,
          p_players: players,
          p_visibility: intent.public ? "public" : "private",
          p_settings: settingsJson({ timer: game.config.onlineTimers[0] ?? 0, bots: {} }),
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
      return (
        <Choose
          strings={s}
          quick={game.modes.quick}
          rated={game.rated}
          clockLabel={clockLabel}
          ratedLabel={ratedLabel}
          error={error}
          onRun={begin}
        />
      );
    case "working":
      return (
        <Waiting
          label={
            stage.intent.kind === "quick"
              ? s.finding
              : stage.intent.kind === "rated"
                ? s.rated.searching
                : stage.intent.kind === "create"
                  ? s.creating
                  : s.joining
          }
        />
      );
    case "accountsOnly": {
      // Back to this search once signed in.
      const next = `${location.pathname}?rated=${String(stage.timer)}`;
      return (
        <div className="grid justify-items-start gap-3">
          <p>{s.rated.accountsOnly}</p>
          <a
            href={`${paths.signIn}?next=${encodeURIComponent(next)}`}
            className="font-semibold text-link underline-offset-4 hover:underline"
          >
            {s.rated.signIn}
          </a>
        </div>
      );
    }
    case "searching":
      return (
        <RatedSearch
          supabase={stage.supabase}
          game={{ id: game.id, version: game.version }}
          timer={stage.timer}
          label={ratedLabel(stage.timer)}
          strings={s.rated}
          locale={locale}
          onPaired={(room) => {
            history.replaceState(history.state, "", `${location.pathname}?room=${room.code}`);
            setStage({
              kind: "room",
              supabase: stage.supabase,
              identity: stage.identity,
              roomId: room.id,
              code: room.code,
            });
          }}
          onCancel={() => {
            history.replaceState(history.state, "", location.pathname);
            setStage({ kind: "choose" });
          }}
          onError={(code) => {
            history.replaceState(history.state, "", location.pathname);
            setError(s.errors[code]);
            setStage({ kind: "choose" });
          }}
        />
      );
    case "profile":
      return (
        <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-surface p-5">
          <GuestProfileForm
            strings={guest}
            privacyHref={paths.privacy}
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
          chat={chat}
          turn={turn}
          race={race}
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
  quick,
  rated,
  clockLabel,
  ratedLabel,
  error,
  onRun,
}: {
  strings: RoomStrings;
  quick: boolean;
  rated: readonly RatedClock[];
  clockLabel: (timer: number) => string;
  ratedLabel: (timer: number) => string;
  error: string | null;
  onRun: (intent: Intent) => void;
}) {
  const id = useId();
  const [code, setCode] = useState("");
  return (
    <div className="grid gap-6">
      {rated.length > 0 && (
        <RatedClocks
          clocks={rated}
          clockLabel={clockLabel}
          label={ratedLabel}
          strings={s.rated}
          onRun={onRun}
        />
      )}
      <div className="flex flex-wrap gap-3">
        {quick && (
          <Button
            size="lg"
            onClick={() => {
              onRun({ kind: "quick" });
            }}
          >
            {s.quick}
          </Button>
        )}
        <Button
          size="lg"
          variant={quick ? "outline" : "primary"}
          onClick={() => {
            onRun({ kind: "create" });
          }}
        >
          {s.create}
        </Button>
      </div>
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

/** The rated clocks, pool by pool: picking one starts the search. */
function RatedClocks({
  clocks,
  clockLabel,
  label,
  strings: r,
  onRun,
}: {
  clocks: readonly RatedClock[];
  clockLabel: (timer: number) => string;
  label: (timer: number) => string;
  strings: RatedStrings;
  onRun: (intent: Intent) => void;
}) {
  const pools = [...new Set(clocks.map((clock) => clock.pool))];
  return (
    <section className="grid gap-3" aria-labelledby="rated-heading">
      <h2 id="rated-heading" className="text-xl">
        {r.title}
      </h2>
      <p className="text-muted">{r.intro}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {pools.map((pool) => (
          <div key={pool} className="grid gap-2">
            <h3 className="text-sm font-semibold text-muted">{r.pools[pool] ?? pool}</h3>
            <div className="flex flex-wrap gap-2">
              {clocks
                .filter((clock) => clock.pool === pool)
                .map((clock) => (
                  <Button
                    key={clock.timer}
                    variant="outline"
                    aria-label={label(clock.timer)}
                    className="tabular-nums"
                    onClick={() => {
                      onRun({ kind: "rated", timer: clock.timer });
                    }}
                  >
                    {clockLabel(clock.timer)}
                  </Button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
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
  chat: ChatStrings;
  turn: TurnStrings;
  race: RaceStrings;
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
  chat,
  turn,
  race,
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
  // The room page's right-hand pane (play/[game].astro), for the chat.
  const [chatSlot] = useState(() => document.getElementById("room-chat"));
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
    const beat = () => {
      send(supabase.rpc("room_heartbeat", { p_room: roomId }));
    };
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
          ...(change.options === undefined ? {} : { options: change.options }),
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

  // The chat lives in the page's right-hand pane; it stays mounted during a
  // match (under the full-screen board), so nothing is missed.
  const chatPane = (
    <RoomChat supabase={supabase} roomId={roomId} self={self} locale={locale} strings={chat} />
  );
  const docked = chatSlot ? createPortal(chatPane, chatSlot) : chatPane;

  if (match) {
    if (!transport) return <Waiting label={s.joining} />;
    if (game.race) {
      const limit = game.config.timers[onlineTimer(game.config, settings.timer)];
      return (
        <>
          {docked}
          <RaceMatch
            key={match.seed}
            supabase={supabase}
            transport={transport}
            roomId={roomId}
            self={self}
            host={room.host_id}
            match={match}
            seed={match.seed}
            startedAt={settings.startedAt}
            limitMs={(limit?.kind === "countdown" ? limit.seconds : 600) * 1000}
            countdown={match.countdown}
            present={present}
            avatars={new Map(view.members.map((m) => [m.userId, m.avatar]))}
            game={{ id: game.id, name: game.name, ui: game.ui, race: game.race }}
            options={settings.options}
            locale={locale}
            dir={dir}
            strings={s}
            race={race}
            player={player}
            onLeave={actions.leave}
          />
        </>
      );
    }
    const status = (userId: string) => view.members.find((m) => m.userId === userId)?.status;
    const rated = parseRated(room.rated);
    return (
      <>
        {docked}
        <OnlineMatch
          key={match.seed}
          supabase={supabase}
          transport={transport}
          roomId={roomId}
          self={self}
          host={room.host_id}
          match={match}
          seed={match.seed}
          rated={rated}
          startsAt={
            rated && settings.startedAt !== null ? settings.startedAt + RATED_COUNTDOWN_MS : null
          }
          // A rated room plays one game: the players search again instead of a rematch.
          onNewOpponent={() => {
            void call(() => supabase.rpc("leave_room", { p_room: roomId })).then(() => {
              location.assign(`${location.pathname}?rated=${String(settings.timer)}`);
            });
          }}
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
      </>
    );
  }

  return (
    <>
      {docked}
      <LobbyView
        snapshot={view}
        settings={settings}
        self={self}
        present={present}
        config={game.config}
        allowPublic={game.modes.public}
        race={game.race ? { options: game.race.options, strings: race } : null}
        turn={turn}
        strings={s}
        locale={locale}
        gameName={game.name}
        inviteUrl={`${location.origin}${location.pathname}?room=${room.code}`}
        busy={busy}
        error={error}
        actions={actions}
      />
    </>
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
