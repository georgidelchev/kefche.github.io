// Online play on a table (Phase 12, ADR-0047): for games with hidden
// information, the arena server holds the match and this browser only ever
// sees its own view of it. The session connects to the room's table, shows
// each state it sends (bot moves one by one, BOT_MIN_THINK_MS apart, as the
// table paces their clocks), sends the player's actions, and reconnects
// after a drop. At the end the table reveals its seed, which must hash to
// the commitment it published at the start.
import { BOT_MIN_THINK_MS } from "../bots";
import { isSideAction, legalMove, type GameResult } from "../engines";
import {
  TABLE_ERRORS,
  TABLE_PING,
  TABLE_PROTOCOL_VERSION,
  parseTableText,
  tableServerText,
  type TableState,
} from "../table-protocol";
import { lowTimeMs } from "../timers";

import type { TurnSession, TurnSessionOptions, TurnView } from "./turn-session";

const PING_MS = 20_000;
const RECONNECT_MS = [500, 1000, 2000, 4000, 8000];
const TICK_MS = 200;

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function createTableSession<State, Action, Config>(
  options: TurnSessionOptions<State, Action, Config>,
): TurnSession<Action> {
  const { engine, context } = options;
  const { match, online, seed } = context;
  const table = online?.table;
  if (!match || !online || !table) throw new Error("createTableSession needs a table");
  const { seats, timer } = match;
  const url = `${table.url.replace(/^http/, "ws")}/tables/${online.roomId}/${seed}`;

  let socket: WebSocket | null = null;
  let destroyed = false;
  let fatal = false;
  let attempt = 0;
  let seat: number | null = match.localSeat ?? null;
  let commit: string | null = null;
  let started = false;
  let finished = false;
  /** The state on screen, and when it arrived (its clocks were right then). */
  let shown: { state: TableState; at: number } | null = null;
  let shownAt = 0;
  const queue: { state: TableState; at: number }[] = [];
  let pumpTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const closed = () => destroyed;
  const isBotMove = (s: TableState) =>
    s.last !== null && (seats[s.last.seat]?.kind === "bot" || s.standIn[s.last.seat] === true);

  const clocks = (s: TableState, at: number) => {
    const passed = Date.now() - at;
    return s.clocks.map((left, i) =>
      left === null ? null : Math.max(0, left - (s.toMove.includes(i) ? passed : 0)),
    );
  };

  const report = () => {
    if (!shown) return;
    const { state: s, at } = shown;
    const left = clocks(s, at);
    const low = lowTimeMs(timer);
    context.report({
      type: "turn",
      toMove: s.toMove,
      clocks: left,
      lowTime: left.map(
        (l, i) => s.toMove.includes(i) && l !== null && low !== null && l > 0 && l <= low,
      ),
      thinking: s.toMove.some((i) => seats[i]?.kind === "bot" || s.standIn[i] === true),
    });
  };

  const show = (next: { state: TableState; at: number }) => {
    shown = next;
    shownAt = performance.now();
    const s = next.state;
    if (!started) {
      started = true;
      context.report({ type: "start" });
    }
    const result = s.result as GameResult | null;
    const view: TurnView<State, Action> = {
      state: s.view as State,
      viewer: result ? null : seat,
      handoff: null,
      toMove: s.toMove,
      humanSeat: seat !== null && s.toMove.includes(seat) && !result ? seat : null,
      thinking: s.toMove.some((i) => seats[i]?.kind === "bot"),
      lastMove:
        s.last && s.last.action !== null
          ? { seat: s.last.seat, action: s.last.action as Action }
          : null,
      result,
      canUndo: false,
    };
    options.onChange(view);
    report();
    if (result && !finished) {
      finished = true;
      context.report({ type: "finish", result });
    }
  };

  /** Shows queued states in order, a bot's move no sooner than BOT_MIN_THINK_MS after the last. */
  const pump = () => {
    pumpTimer = null;
    while (queue.length > 0 && !destroyed) {
      const next = queue[0];
      if (!next) break;
      const wait = isBotMove(next.state) ? BOT_MIN_THINK_MS - (performance.now() - shownAt) : 0;
      if (wait > 0) {
        pumpTimer = setTimeout(pump, wait);
        return;
      }
      queue.shift();
      show(next);
    }
  };

  const onMessage = (data: unknown) => {
    if (typeof data !== "string") return;
    const message = parseTableText(tableServerText, data);
    if (!message) return;
    switch (message.t) {
      case "welcome":
        attempt = 0;
        seat = message.seat;
        commit = message.commit;
        return;
      case "state":
        // A reconnect resends the current state; anything older is dropped.
        if (shown && message.n < shown.state.n) return;
        queue.push({ state: message, at: Date.now() });
        if (pumpTimer === null) pump();
        return;
      case "over": {
        const promised = commit;
        void sha256(message.seed).then((hash) => {
          if (promised !== null && hash !== promised) {
            console.error("table: the revealed seed doesn't match its commitment");
          }
        });
        return;
      }
      case "error":
        if (TABLE_ERRORS[message.code].fatal) fatal = true;
        console.error(`table: ${message.code}`);
        return;
      case "pong":
        return;
    }
  };

  const connect = async () => {
    if (destroyed || fatal) return;
    let token: string;
    try {
      token = await table.token();
    } catch {
      fatal = true;
      return;
    }
    // The page may have closed the game while the token came.
    if (closed()) return;
    const ws = new WebSocket(url);
    socket = ws;
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          t: "hello",
          v: TABLE_PROTOCOL_VERSION,
          token,
          room: online.roomId,
          match: seed,
        }),
      );
    };
    ws.onmessage = (event: MessageEvent) => {
      onMessage(event.data);
    };
    ws.onclose = () => {
      if (socket === ws) socket = null;
      if (destroyed || fatal || finished) return;
      const wait = RECONNECT_MS[Math.min(attempt, RECONNECT_MS.length - 1)] ?? 8000;
      attempt++;
      retryTimer = setTimeout(() => void connect(), wait);
    };
  };

  void connect();
  const pingTimer = setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(TABLE_PING);
  }, PING_MS);
  const tick = timer.kind === "none" ? null : setInterval(report, TICK_MS);

  return {
    act(by, action) {
      const current = shown?.state;
      if (!current || current.result || by !== seat || queue.length > 0) return false;
      if (socket?.readyState !== WebSocket.OPEN) return false;
      const view = current.view as State;
      const legal =
        isSideAction(engine, view, by, action) ||
        (current.toMove.includes(by) && legalMove(engine, view, by, action) !== undefined);
      if (!legal) return false;
      socket.send(JSON.stringify({ t: "act", n: current.n, action }));
      return true;
    },
    // Online: no undo, no pause (SPEC §11), and each player has their own device.
    undo() {
      // Nothing to take back on a table.
    },
    pause() {
      // The match goes on for everyone else.
    },
    resume() {
      // Never paused.
    },
    refresh() {
      // The table knows who is away.
    },
    reveal() {
      // No one hands a device over online.
    },
    destroy() {
      destroyed = true;
      if (pumpTimer !== null) clearTimeout(pumpTimer);
      if (retryTimer !== null) clearTimeout(retryTimer);
      clearInterval(pingTimer);
      if (tick !== null) clearInterval(tick);
      socket?.close(1000);
      socket = null;
    },
  };
}
