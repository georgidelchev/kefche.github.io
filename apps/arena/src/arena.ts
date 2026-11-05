// One arena (Phase 9 step 1, the spike): a Durable Object that holds its
// players' WebSockets, runs the world at 30 Hz while anyone is connected, and
// sends each player at 15 Hz only what is near them. Sending is free on
// Cloudflare; each incoming message bills as 1/20 of a request, so clients
// send inputs only when they change, plus a ping every 2 s.
//
// The world here is dummy movers (bots wandering, players steering at a
// fixed speed): enough to measure the transport before Worm Rush's engine
// (steps 2 and 7) takes its place.
import { DurableObject } from "cloudflare:workers";
import { z } from "zod/mini";

import { verifyToken } from "./auth";
import { decodeClientFrame, encodeSnapshot, type Input, type WireEntity } from "./wire";

import type { Env } from "./env";

const TICK_HZ = 30;
const TICK_MS = 1000 / TICK_HZ;
const MAX_CATCH_UP = 4;
const SNAPSHOT_EVERY = 2; // ticks: 15 Hz
const MAX_PLAYERS = 15;
const BOTS = 20;
const WORLD_RADIUS = 3000;
const VIEW_RADIUS = 1400;
const SPEED = 140; // units a second
const BOOST = 2;
const TURN_RATE = 4; // radians a second
const HELLO_MS = 5000;
const MAX_INPUTS_PER_SECOND = 20;

const helloSchema = z.object({
  t: z.literal("hello"),
  token: z.string().check(z.minLength(1), z.maxLength(4096)),
});

interface Mover extends WireEntity {
  /** The heading it turns toward. */
  target: number;
  boost: boolean;
}

interface Player {
  userId: string;
  mover: Mover;
  /** Inputs this second, for the rate limit. */
  inputs: number;
  windowStart: number;
}

export class Arena extends DurableObject<Env> {
  private readonly pending = new Map<WebSocket, number>();
  private readonly players = new Map<WebSocket, Player>();
  private readonly bots: Mover[] = [];
  private nextId = 1;
  private tick = 0;
  private loop: ReturnType<typeof setInterval> | null = null;
  /** When the world's latest tick was due. */
  private lastTickAt = 0;
  /** When the latest tick actually ran, for the stats. */
  private lastStepAt = 0;
  private readonly stats = {
    inFrames: 0,
    outFrames: 0,
    outBytes: 0,
    latestTickMs: 0,
    worstTickMs: 0,
  };

  override fetch(): Response {
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);
    this.pending.set(server, Date.now());
    this.start();
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    this.stats.inFrames++;
    const player = this.players.get(ws);
    if (player) {
      if (typeof message === "string") {
        if (message === '{"t":"stats"}') this.sendText(ws, { t: "stats", ...this.report() });
        return;
      }
      const frame = decodeClientFrame(message);
      if (frame?.kind === "ping") this.send(ws, frame.frame);
      else if (frame?.kind === "input" && this.allowInput(player))
        this.steer(player.mover, frame.input);
      return;
    }
    if (!this.pending.has(ws)) {
      ws.close(4000, "unknown");
      return;
    }
    const hello = typeof message === "string" ? helloSchema.safeParse(safeJson(message)) : null;
    if (!hello?.success) {
      this.refuse(ws, "hello_expected");
      return;
    }
    const user = await verifyToken(this.env, hello.data.token);
    if (!this.pending.delete(ws)) return; // closed while we checked
    if (!user) {
      this.refuse(ws, "invalid_token");
      return;
    }
    // One socket per player: a second tab takes over from the first.
    for (const [other, p] of this.players) {
      if (p.userId === user.id) this.leave(other, 4002, "replaced");
    }
    if (this.players.size >= MAX_PLAYERS) {
      this.refuse(ws, "arena_full");
      return;
    }
    const mover = this.spawn();
    this.players.set(ws, { userId: user.id, mover, inputs: 0, windowStart: Date.now() });
    this.sendText(ws, {
      t: "welcome",
      self: mover.id,
      tickRate: TICK_HZ,
      snapshotRate: TICK_HZ / SNAPSHOT_EVERY,
    });
  }

  override webSocketClose(ws: WebSocket): void {
    this.leave(ws);
  }

  override webSocketError(ws: WebSocket): void {
    this.leave(ws);
  }

  private start(): void {
    if (this.loop) return;
    while (this.bots.length < BOTS) this.bots.push(this.spawn());
    this.lastTickAt = Date.now();
    // Timers aren't exact (Windows rounds them to 15.6 ms), so the interval
    // runs twice as often as the world and steps it by the clock, catching
    // up at most MAX_CATCH_UP ticks at once.
    this.loop = setInterval(() => {
      const now = Date.now();
      let due = Math.min(MAX_CATCH_UP, Math.floor((now - this.lastTickAt) / TICK_MS));
      if (due === MAX_CATCH_UP) this.lastTickAt = now - due * TICK_MS;
      while (due-- > 0) {
        this.lastTickAt += TICK_MS;
        this.step();
      }
    }, TICK_MS / 2);
  }

  private stopIfEmpty(): void {
    if (this.players.size > 0 || this.pending.size > 0 || !this.loop) return;
    clearInterval(this.loop);
    this.loop = null;
    this.lastStepAt = 0;
    this.bots.length = 0;
  }

  private step(): void {
    const now = Date.now();
    if (this.lastStepAt) {
      this.stats.latestTickMs = now - this.lastStepAt;
      this.stats.worstTickMs = Math.max(this.stats.worstTickMs, this.stats.latestTickMs);
    }
    this.lastStepAt = now;
    const dt = 1 / TICK_HZ;
    for (const [ws, at] of this.pending) {
      if (now - at > HELLO_MS) this.refuse(ws, "hello_timeout");
    }
    for (const bot of this.bots) {
      if (Math.random() < dt / 2) bot.target = Math.random() * Math.PI * 2;
      move(bot, dt);
    }
    for (const { mover } of this.players.values()) move(mover, dt);
    this.tick++;
    if (this.tick % SNAPSHOT_EVERY === 0) this.sendSnapshots();
  }

  private sendSnapshots(): void {
    const everyone = [...this.bots, ...[...this.players.values()].map((p) => p.mover)];
    for (const [ws, { mover }] of this.players) {
      const near = everyone.filter(
        (e) => (e.x - mover.x) ** 2 + (e.y - mover.y) ** 2 <= VIEW_RADIUS ** 2,
      );
      this.send(ws, encodeSnapshot(this.tick, near));
    }
  }

  private spawn(): Mover {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * WORLD_RADIUS * 0.8;
    const heading = Math.random() * Math.PI * 2;
    return {
      id: this.nextId++ & 0xffff,
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
      heading,
      target: heading,
      boost: false,
    };
  }

  private steer(mover: Mover, input: Input): void {
    mover.target = input.heading;
    mover.boost = input.boost;
  }

  private allowInput(player: Player): boolean {
    const now = Date.now();
    if (now - player.windowStart >= 1000) {
      player.windowStart = now;
      player.inputs = 0;
    }
    return ++player.inputs <= MAX_INPUTS_PER_SECOND;
  }

  private send(ws: WebSocket, data: ArrayBuffer | string): void {
    try {
      ws.send(data);
      this.stats.outFrames++;
      this.stats.outBytes += typeof data === "string" ? data.length : data.byteLength;
    } catch {
      this.leave(ws);
    }
  }

  private sendText(ws: WebSocket, value: object): void {
    this.send(ws, JSON.stringify(value));
  }

  private refuse(ws: WebSocket, code: string): void {
    this.sendText(ws, { t: "error", code });
    this.pending.delete(ws);
    this.leave(ws, 4001, code);
  }

  private leave(ws: WebSocket, code = 1000, reason = ""): void {
    this.pending.delete(ws);
    this.players.delete(ws);
    try {
      ws.close(code, reason);
    } catch {
      // Already closed.
    }
    this.stopIfEmpty();
  }

  private report() {
    return { players: this.players.size, bots: this.bots.length, tick: this.tick, ...this.stats };
  }
}

function move(m: Mover, dt: number): void {
  // Turn toward the target the short way, at most TURN_RATE a second.
  const diff = Math.atan2(Math.sin(m.target - m.heading), Math.cos(m.target - m.heading));
  m.heading += Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, diff));
  const speed = SPEED * (m.boost ? BOOST : 1) * dt;
  m.x += Math.cos(m.heading) * speed;
  m.y += Math.sin(m.heading) * speed;
  // The edge turns movers back toward the middle.
  if (m.x * m.x + m.y * m.y > WORLD_RADIUS * WORLD_RADIUS) m.target = Math.atan2(-m.y, -m.x);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
