// A player's connection to an arena, the same to the game whether the arena
// runs on the arena server (connectArena: a WebSocket) or in this page
// (createLocalArena: the solo arena against bots, and tests). Inputs go out
// only when they change, at most 10 a second; a ping every 2 s keeps the
// socket alive and measures the round trip. A dropped socket reconnects by
// itself unless the server said not to (a fatal error code).

import { ArenaHost, type ArenaHostOptions } from "../arena-host";
import {
  ARENA_ERRORS,
  ARENA_PROTOCOL_VERSION,
  arenaServerText,
  decodeArenaFrame,
  encodeInputFrame,
  encodePingFrame,
  parseArenaText,
  type ArenaErrorCode,
} from "../arena-protocol";

import type { ArenaBots, ArenaJoiner, RealtimeEngine } from "../realtime";

export type ArenaStatus = "connecting" | "playing" | "reconnecting" | "closed";

export interface ArenaHandlers<Snapshot> {
  /** In the arena as participant `self` (again after each reconnect). */
  onWelcome(self: number): void;
  /** A snapshot of server tick `tick`; `ack` is the last input seq it had applied. */
  onSnapshot(snapshot: Snapshot, tick: number, ack: number): void;
  /** `error` is set when the arena refused or ended the connection. */
  onStatus(status: ArenaStatus, error?: ArenaErrorCode): void;
}

export interface ArenaConnection<Input> {
  readonly status: ArenaStatus;
  /** Sends the input if it changed; returns its seq (for prediction), or null when unchanged. */
  setInput(input: Input): number | null;
  respawn(): void;
  /** Round trip in ms, or null before the first measurement. */
  latency(): number | null;
  close(): void;
}

const INPUT_MIN_MS = 100;
const PING_MS = 2000;
const BACKOFF_MS = [500, 1000, 2000, 4000, 8000];

type Codecs<Input, Snapshot> = Pick<
  RealtimeEngine<unknown, Input, Snapshot, unknown, unknown>,
  "inputCodec" | "snapshotCodec"
>;

const sameBytes = (a: Uint8Array | null, b: Uint8Array) =>
  a !== null && a.length === b.length && a.every((v, i) => v === b[i]);

export interface ConnectArenaOptions<Input, Snapshot> {
  /** wss://…/arenas/<name> */
  url: string;
  /** A current Supabase access token (asked again on each reconnect). */
  token: () => Promise<string>;
  look: number;
  engine: Codecs<Input, Snapshot>;
  handlers: ArenaHandlers<Snapshot>;
}

export function connectArena<Input, Snapshot>(
  options: ConnectArenaOptions<Input, Snapshot>,
): ArenaConnection<Input> {
  const { engine, handlers } = options;
  let status: ArenaStatus = "connecting";
  let socket: WebSocket | null = null;
  let previous: Snapshot | null = null;
  let seq = 0;
  let lastSent: Uint8Array | null = null;
  let lastSentAt = 0;
  let queued: Uint8Array | null = null;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let rtt: number | null = null;
  let nonce = 0;
  const pings = new Map<number, number>();
  let refusal: ArenaErrorCode | undefined;

  const setStatus = (next: ArenaStatus, error?: ArenaErrorCode) => {
    status = next;
    handlers.onStatus(next, error);
  };

  const sendNow = (body: Uint8Array) => {
    if (socket?.readyState !== WebSocket.OPEN) return;
    socket.send(encodeInputFrame(seq, body));
    lastSent = body;
    lastSentAt = performance.now();
  };

  const stopTimers = () => {
    if (flushTimer) clearTimeout(flushTimer);
    if (pingTimer) clearInterval(pingTimer);
    flushTimer = null;
    pingTimer = null;
    pings.clear();
  };

  const open = async () => {
    let token: string;
    try {
      token = await options.token();
    } catch {
      scheduleReconnect();
      return;
    }
    if (status === "closed") return;
    const ws = new WebSocket(options.url);
    ws.binaryType = "arraybuffer";
    socket = ws;
    refusal = undefined;
    ws.onopen = () => {
      ws.send(JSON.stringify({ t: "hello", v: ARENA_PROTOCOL_VERSION, token, look: options.look }));
    };
    ws.onmessage = ({ data }: MessageEvent<string | ArrayBuffer>) => {
      if (typeof data === "string") {
        const text = parseArenaText(arenaServerText, data);
        if (text?.t === "welcome") {
          attempt = 0;
          previous = null;
          // Whatever input was held before a reconnect goes again.
          if (lastSent) sendNow(lastSent);
          pingTimer = setInterval(() => {
            const n = ++nonce;
            pings.set(n, performance.now());
            if (ws.readyState === WebSocket.OPEN) ws.send(encodePingFrame(n));
          }, PING_MS);
          setStatus("playing");
          handlers.onWelcome(text.self);
        } else if (text?.t === "error") {
          // The server's own close can lag by seconds; close from here at once.
          refusal = text.code;
          ws.close();
        }
        return;
      }
      const frame = decodeArenaFrame(new Uint8Array(data));
      if (frame?.kind === "snapshot") {
        try {
          const snapshot = engine.snapshotCodec.decode(frame.snapshot, previous);
          previous = snapshot;
          handlers.onSnapshot(snapshot, frame.tick, frame.ack);
        } catch {
          // A frame we can't read: start over with a full snapshot.
          ws.close();
        }
      } else if (frame?.kind === "pong") {
        const at = pings.get(frame.nonce);
        pings.delete(frame.nonce);
        if (at !== undefined) rtt = performance.now() - at;
      }
    };
    ws.onclose = () => {
      if (socket !== ws) return;
      socket = null;
      stopTimers();
      if (status === "closed") return;
      if (refusal && ARENA_ERRORS[refusal].fatal) {
        setStatus("closed", refusal);
        return;
      }
      scheduleReconnect(refusal);
    };
  };

  const scheduleReconnect = (error?: ArenaErrorCode) => {
    if (status === "closed") return;
    setStatus("reconnecting", error);
    const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 8000;
    attempt++;
    retry = setTimeout(() => {
      retry = null;
      void open();
    }, delay);
  };

  void open();
  handlers.onStatus("connecting");

  return {
    get status() {
      return status;
    },
    setInput(input) {
      const body = engine.inputCodec.encode(input);
      if (sameBytes(queued ?? lastSent, body)) return null;
      seq = (seq + 1) & 0xffff;
      const wait = INPUT_MIN_MS - (performance.now() - lastSentAt);
      if (wait <= 0) {
        queued = null;
        sendNow(body);
      } else {
        queued = body;
        flushTimer ??= setTimeout(() => {
          flushTimer = null;
          if (queued) sendNow(queued);
          queued = null;
        }, wait);
      }
      return seq;
    },
    respawn() {
      if (socket?.readyState === WebSocket.OPEN) socket.send('{"t":"respawn"}');
    },
    latency: () => rtt,
    close() {
      status = "closed";
      if (retry) clearTimeout(retry);
      stopTimers();
      socket?.close();
      socket = null;
      handlers.onStatus("closed");
    },
  };
}

export interface LocalArenaOptions<World, Input, Snapshot, Event, Config> {
  engine: RealtimeEngine<World, Input, Snapshot, Event, Config>;
  bots: ArenaBots<World, Input>;
  host: ArenaHostOptions<Config>;
  player: Omit<ArenaJoiner, "bot">;
  handlers: ArenaHandlers<Snapshot>;
  /** Every tick's events, for the solo arena's sounds and its result. */
  onEvents?: (events: Event[]) => void;
}

export interface LocalArena<World, Input, Snapshot, Event, Config> extends ArenaConnection<Input> {
  /** The arena itself: the solo arena reads the player's result from it. */
  readonly host: ArenaHost<World, Input, Snapshot, Event, Config>;
  readonly self: number;
}

/**
 * The solo arena: the same ArenaHost the server runs, stepped in this page,
 * its snapshots going through the same codec as online. It stops while the
 * page is hidden, since nobody else is playing.
 */
export function createLocalArena<World, Input, Snapshot, Event, Config>(
  options: LocalArenaOptions<World, Input, Snapshot, Event, Config>,
): LocalArena<World, Input, Snapshot, Event, Config> {
  const { engine, handlers } = options;
  const host = new ArenaHost(engine, options.bots, options.host);
  const self = host.join(options.player);
  if (self === null) throw new Error("the local arena has no room for its player");
  const tickMs = 1000 / engine.ticksPerSecond;
  let status: ArenaStatus = "playing";
  let previous: Snapshot | null = null;
  let seq = 0;
  let last: Uint8Array | null = null;
  let due = performance.now();

  const loop = setInterval(() => {
    const now = performance.now();
    if (document.hidden) {
      due = now;
      return;
    }
    // Stepped by the clock, catching up at most 4 ticks (as the server does).
    let ticks = Math.min(4, Math.floor((now - due) / tickMs));
    if (ticks === 4) due = now - ticks * tickMs;
    while (ticks-- > 0) {
      due += tickMs;
      const { events, frames } = host.step();
      if (events.length > 0) options.onEvents?.(events);
      const frame = frames.get(self);
      const decoded = frame ? decodeArenaFrame(frame) : null;
      if (decoded?.kind === "snapshot") {
        previous = engine.snapshotCodec.decode(decoded.snapshot, previous);
        handlers.onSnapshot(previous, decoded.tick, decoded.ack);
      }
    }
  }, tickMs / 2);

  queueMicrotask(() => {
    handlers.onStatus("playing");
    handlers.onWelcome(self);
  });

  return {
    host,
    self,
    get status() {
      return status;
    },
    setInput(input) {
      const body = engine.inputCodec.encode(input);
      if (sameBytes(last, body)) return null;
      last = body;
      seq = (seq + 1) & 0xffff;
      host.input(self, seq, body);
      return seq;
    },
    respawn() {
      host.respawn(self);
    },
    latency: () => 0,
    close() {
      clearInterval(loop);
      status = "closed";
      handlers.onStatus("closed");
    },
  };
}
