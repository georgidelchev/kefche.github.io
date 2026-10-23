// Online turn-based matches (SPEC §10.4, §10.5). One member, the host, runs
// the match with the same createTurnSession as offline play, bots included.
// It checks every move against the engine and shares the whole match after
// each change. Everyone else mirrors the host's snapshots and sends their
// own moves to it.
//
// - Trust: snapshots count only from the member the rooms row names as host,
//   and the host accepts a move only from the member in that seat, made on
//   the latest state.
// - Host migration: when the host has been gone from presence for 5 s, the
//   player who joined earliest claims the room through the database (first
//   claim wins) and carries on from the last snapshot.
// - Away players: their turns are skipped; with clocks, their clock runs.
// - Rejoining: a member asks the host for the latest state on connecting.

import { stateHash, createMessenger, type Message, type Payload } from "../protocol";
import { elapse, isLowTime, timeLeft } from "../timers";
import {
  createTurnSession,
  type TurnSession,
  type TurnSessionOptions,
  type TurnSnapshot,
  type TurnView,
} from "./turn-session";

import type { GameResult } from "../engines";

/** How long the host may be missing before another player takes over. */
export const HOST_TIMEOUT_MS = 5000;
const TICK_MS = 250;

export function createOnlineTurnSession<State, Action, Config>(
  options: TurnSessionOptions<State, Action, Config>,
): TurnSession<Action> {
  const { engine, context } = options;
  const { online, match } = context;
  if (!online || !match)
    throw new Error("createOnlineTurnSession needs context.online and context.match");
  const { transport, roomId, self, seatMembers } = online;
  const { seats, timer } = match;
  const message = createMessenger(roomId, self);
  const localSeats = seatMembers.flatMap((member, seat) => (member === self ? [seat] : []));

  let destroyed = false;
  let host = online.host();
  /** The running match, when this member hosts. */
  let hosted: TurnSession<Action> | null = null;
  /** The latest match known here (own when hosting, the host's otherwise). */
  let snapshot: TurnSnapshot<State, Action> | null = null;
  /** When `snapshot` arrived, to run the mover's clock between snapshots. */
  let snapshotAt = 0;
  let present = new Map<string, number>();
  let finished = false;
  let started = false;
  let hostGoneTimer: ReturnType<typeof setTimeout> | null = null;

  const isAway = (seat: number) => {
    const member = seatMembers[seat];
    return member !== null && member !== undefined && !present.has(member);
  };

  const payloadOf = (snap: TurnSnapshot<State, Action>): Payload<"state"> => ({
    moves: snap.moves,
    state: snap.state,
    timers: [...snap.timers],
    hash: stateHash(snap.state),
    ...(snap.last ? { last: snap.last } : {}),
    ...(snap.timeout ? { result: snap.timeout } : {}),
  });

  // ---------------------------------------------------------------- hosting
  const startHosting = () => {
    if (hosted || destroyed) return;
    hosted = createTurnSession({
      ...options,
      localSeats,
      isAway,
      ...(snapshot ? { from: snapshot } : {}),
      onSnapshot(snap) {
        snapshot = snap;
        transport.broadcast(message("state", payloadOf(snap)));
      },
    });
  };
  const stopHosting = () => {
    hosted?.destroy();
    hosted = null;
  };

  // ------------------------------------------------------------- mirroring
  const result = (): GameResult | null =>
    snapshot ? (snapshot.timeout ?? engine.result(snapshot.state)) : null;
  const toMove = () => (snapshot && !result() ? engine.currentSeats(snapshot.state) : []);

  const reportTurn = () => {
    if (!snapshot) return;
    const seatsToMove = toMove();
    const mover = seatsToMove[0];
    let timers = { remainingMs: snapshot.timers };
    if (mover !== undefined) timers = elapse(timer, timers, mover, Date.now() - snapshotAt);
    context.report({
      type: "turn",
      toMove: seatsToMove,
      clocks: seats.map((_, i) => timeLeft(timer, timers, i)),
      lowTime: seats.map((_, i) => seatsToMove.includes(i) && isLowTime(timer, timers, i)),
      thinking: mover !== undefined && seats[mover]?.kind === "bot",
    });
  };

  const mirror = () => {
    if (!snapshot || hosted) return;
    if (!started) {
      started = true;
      context.report({ type: "start" });
    }
    const seatsToMove = toMove();
    const mover = seatsToMove[0];
    const view: TurnView<State, Action> = {
      state: snapshot.state,
      toMove: seatsToMove,
      humanSeat: mover !== undefined && localSeats.includes(mover) ? mover : null,
      thinking: mover !== undefined && seats[mover]?.kind === "bot",
      lastMove: snapshot.last,
      result: result(),
      canUndo: false,
    };
    options.onChange(view);
    reportTurn();
    const over = result();
    if (over && !finished) {
      finished = true;
      context.report({ type: "finish", result: over });
    }
  };

  const askForState = () => {
    if (host && host !== self) transport.send(host, message("sync", {}));
  };

  /** The legal action equal to one that arrived as plain data. */
  const legal = (state: State, seat: number, action: unknown): Action | undefined => {
    const wanted = JSON.stringify(action);
    return engine.legalActions(state, seat).find((a) => JSON.stringify(a) === wanted);
  };

  const onMessage = (m: Message) => {
    if (destroyed) return;
    if (m.type === "state") {
      if (hosted || m.from !== host) return;
      const p = m.payload;
      if (stateHash(p.state) !== p.hash) {
        askForState();
        return;
      }
      if (snapshot && p.moves < snapshot.moves) return;
      snapshot = {
        moves: p.moves,
        state: p.state as State,
        timers: p.timers,
        last: (p.last as TurnSnapshot<State, Action>["last"] | undefined) ?? null,
        timeout: p.result
          ? {
              completed: p.result.completed,
              ...(p.result.outcome ? { outcome: p.result.outcome } : {}),
            }
          : null,
      };
      snapshotAt = Date.now();
      mirror();
    } else if (m.type === "action") {
      if (!hosted || !snapshot) return;
      const { seat, action, base } = m.payload;
      // Only the member in that seat, and only on the latest state.
      if (seatMembers[seat] !== m.from) return;
      if (base !== snapshot.moves) {
        transport.send(m.from, message("state", payloadOf(snapshot)));
        return;
      }
      const move = legal(snapshot.state, seat, action);
      if (move !== undefined) hosted.act(seat, move);
    } else if (m.type === "sync") {
      if (hosted && snapshot) transport.send(m.from, message("state", payloadOf(snapshot)));
    } else if (m.type === "host") {
      // A hint only: the rooms row decides. Ask once it agrees.
      if (m.from === online.host()) {
        host = m.from;
        askForState();
      }
    }
  };

  // ------------------------------------------------------- host migration
  const elect = async () => {
    if (destroyed || hosted) return;
    // Players in seats, in the order they joined (ties by id).
    const candidates = [...present.entries()]
      .filter(([member]) => seatMembers.includes(member) && member !== host)
      .sort(([a, at], [b, bt]) => at - bt || a.localeCompare(b));
    if (candidates[0]?.[0] !== self) return;
    const from = host;
    if (await online.claimHost(from)) {
      host = self;
      startHosting();
      transport.broadcast(message("host", { moves: snapshot?.moves ?? 0 }));
    }
  };
  const watchHost = () => {
    const gone = host === null || !present.has(host);
    if (!gone || hosted) {
      if (hostGoneTimer !== null) clearTimeout(hostGoneTimer);
      hostGoneTimer = null;
      return;
    }
    hostGoneTimer ??= setTimeout(() => {
      hostGoneTimer = null;
      void elect();
    }, HOST_TIMEOUT_MS);
  };

  const offMessage = transport.onMessage(onMessage);
  const offPresence = transport.onPresence((list) => {
    present = new Map(list.map((p) => [p.memberId, p.joinedAt]));
    hosted?.refresh();
    watchHost();
  });
  const offHost = online.onHostChange((next) => {
    host = next;
    if (next === self) startHosting();
    else if (hosted) {
      // Handed to someone else: follow them from here.
      stopHosting();
      askForState();
    } else askForState();
    watchHost();
  });
  const tick = setInterval(() => {
    if (!hosted && snapshot && !result()) reportTurn();
  }, TICK_MS);

  if (host === self) startHosting();
  else askForState();
  watchHost();

  const act = (seat: number, action: Action): boolean => {
    if (destroyed || !localSeats.includes(seat)) return false;
    if (hosted) return hosted.act(seat, action);
    if (!snapshot || result() || !toMove().includes(seat) || !host) return false;
    if (legal(snapshot.state, seat, action) === undefined) return false;
    transport.send(host, message("action", { seat, action, base: snapshot.moves }));
    return true;
  };

  return {
    act,
    // Online matches have no undo and don't pause (SPEC §11: pause only offline).
    undo() {
      // Nothing to take back online.
    },
    pause() {
      // The match goes on for everyone else.
    },
    resume() {
      // Never paused.
    },
    refresh() {
      hosted?.refresh();
    },
    destroy() {
      destroyed = true;
      clearInterval(tick);
      if (hostGoneTimer !== null) clearTimeout(hostGoneTimer);
      offMessage();
      offPresence();
      offHost();
      stopHosting();
    },
  };
}
