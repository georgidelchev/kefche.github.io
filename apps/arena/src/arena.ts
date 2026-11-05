// One arena: a Durable Object holding its players' WebSockets and the game's
// ArenaHost, stepped at the engine's tick rate while anyone is there. Sending
// is free on Cloudflare and each incoming message bills as 1/20 of a request,
// so clients send inputs only when they change, plus a ping every 2 s.
//
// A player whose socket drops keeps their place for 5 s and gets it back by
// joining again (SPEC §10.5); after that they leave the arena. One socket per
// player: a second tab takes over from the first.
//
// When an account's life ends (knocked out, or leaving the arena while in
// play), the arena reports it to submit-match (results.ts), which counts it.
// Guests' lives aren't reported.
import { DurableObject } from "cloudflare:workers";

import {
  ARENA_PROTOCOL_VERSION,
  ArenaHost,
  arenaClientText,
  decodeArenaFrame,
  encodePongFrame,
  parseArenaText,
  type ArenaErrorCode,
} from "@kefche/game-sdk";

import { arenaEntry } from "./entry";
import { GAMES, type ArenaGame } from "./games";
import { reportLives, type LifeReport } from "./results";

import type { Env } from "./env";

const HELLO_MS = 5000;
/** Silent this long (no input, no ping), a socket counts as dropped. */
const SILENT_MS = 6000;
/** A dropped player's place is kept this long. */
const AWAY_MS = 5000;
const MAX_INPUTS_PER_SECOND = 20;
/** Past this, a client isn't just eager: it's closed. */
const FLOOD_PER_SECOND = 60;
const REPORT_MS = 30_000;
const MAX_CATCH_UP = 4;

interface Connection {
  connectedAt: number;
  lastHeard: number;
  /** The participant id once welcomed. */
  person: number | null;
  userId: string | null;
  frames: number;
  windowStart: number;
}

interface Place {
  person: number;
  socket: WebSocket | null;
  /** When their socket dropped, while it's gone. */
  awaySince: number | null;
  guest: boolean;
  /** Knockouts in this life. */
  kills: number;
}

export class Arena extends DurableObject<Env> {
  private game: ArenaGame | null = null;
  private gameId = "";
  private name = "";
  private host: ArenaHost<unknown, unknown, unknown, unknown, undefined> | null = null;
  private readonly connections = new Map<WebSocket, Connection>();
  private readonly places = new Map<string, Place>();
  /** Who each person in the world is (participant id → user id). */
  private readonly people = new Map<number, string>();
  /** Lives ended since the last report. */
  private lives: LifeReport[] = [];
  /** This instance, in life keys: a restarted arena starts its ticks again. */
  private readonly instance = crypto.randomUUID().slice(0, 8);
  private loop: ReturnType<typeof setInterval> | null = null;
  private dueAt = 0;
  private reportedPeople = -1;
  private reportedAt = 0;

  override fetch(request: Request): Response {
    const [, , gameId = "", name = ""] = new URL(request.url).pathname.split("/");
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);
    const now = Date.now();
    this.connections.set(server, {
      connectedAt: now,
      lastHeard: now,
      person: null,
      userId: null,
      frames: 0,
      windowStart: now,
    });
    const game = GAMES[gameId];
    if (!game) {
      this.refuse(server, "unknown_game");
    } else {
      this.game = game;
      this.gameId = gameId;
      this.name = name;
      this.start();
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const connection = this.connections.get(ws);
    if (!connection || !this.host || !this.game) {
      ws.close(4000, "unknown");
      return;
    }
    const now = Date.now();
    connection.lastHeard = now;
    if (now - connection.windowStart >= 1000) {
      connection.windowStart = now;
      connection.frames = 0;
    }
    if (++connection.frames > FLOOD_PER_SECOND) {
      this.drop(ws);
      return;
    }

    if (typeof message !== "string") {
      if (connection.person === null) return;
      const frame = decodeArenaFrame(new Uint8Array(message));
      if (frame?.kind === "ping") this.send(ws, encodePongFrame(frame.nonce, this.host.tick));
      else if (frame?.kind === "input" && connection.frames <= MAX_INPUTS_PER_SECOND) {
        this.host.input(connection.person, frame.seq, frame.input);
      }
      return;
    }

    const text = parseArenaText(arenaClientText, message);
    if (text?.t === "respawn") {
      if (connection.person !== null) this.host.respawn(connection.person);
      return;
    }
    if (text?.t !== "hello" || connection.userId !== null) {
      this.refuse(ws, "hello_expected");
      return;
    }
    if (text.v !== ARENA_PROTOCOL_VERSION) {
      this.refuse(ws, "version");
      return;
    }
    const player = await arenaEntry(this.env, text.token, this.gameId);
    if (!this.connections.has(ws)) return; // closed while we asked
    if (typeof player === "string") {
      this.refuse(ws, player);
      return;
    }
    connection.userId = player.userId;
    // A look they haven't unlocked is the first one (the picker offers only theirs).
    const look = this.game.lookUnlocked(text.look, player.progress) ? text.look : 0;
    const place = this.places.get(player.userId);
    if (place) {
      // Back within 5 s, or a second tab: the same place, a full snapshot first.
      if (place.socket && place.socket !== ws) this.refuse(place.socket, "replaced", false);
      place.socket = ws;
      place.awaySince = null;
      this.host.resetDelta(place.person);
      connection.person = place.person;
    } else {
      const person = this.host.join({ name: player.name, look });
      if (person === null) {
        this.refuse(ws, "arena_full");
        return;
      }
      this.places.set(player.userId, {
        person,
        socket: ws,
        awaySince: null,
        guest: player.guest,
        kills: 0,
      });
      this.people.set(person, player.userId);
      connection.person = person;
    }
    const engine = this.game.engine;
    this.sendText(ws, {
      t: "welcome",
      self: connection.person,
      tickRate: engine.ticksPerSecond,
      snapshotRate: engine.snapshotsPerSecond,
    });
    this.report();
  }

  override webSocketClose(ws: WebSocket): void {
    this.drop(ws);
  }

  override webSocketError(ws: WebSocket): void {
    this.drop(ws);
  }

  private start(): void {
    if (this.loop || !this.game) return;
    this.host ??= new ArenaHost(this.game.engine, this.game.bots, {
      ...this.game.host,
      seed: `${this.gameId}/${this.name}/${crypto.randomUUID()}`,
      config: undefined,
    });
    const tickMs = 1000 / this.game.engine.ticksPerSecond;
    this.dueAt = Date.now();
    // Timers aren't exact, so the interval runs twice as often as the world
    // and steps it by the clock, catching up at most MAX_CATCH_UP ticks.
    this.loop = setInterval(() => {
      const now = Date.now();
      let due = Math.min(MAX_CATCH_UP, Math.floor((now - this.dueAt) / tickMs));
      if (due === MAX_CATCH_UP) this.dueAt = now - due * tickMs;
      while (due-- > 0) {
        this.dueAt += tickMs;
        this.tick();
      }
      this.housekeeping(now);
      if (this.lives.length > 0 && this.game) {
        const lives = this.lives;
        this.lives = [];
        this.ctx.waitUntil(reportLives(this.env, this.gameId, this.game.version, lives));
      }
    }, tickMs / 2);
  }

  private tick(): void {
    if (!this.host) return;
    const { events, frames } = this.host.step();
    if (events.length > 0 && this.game) {
      for (const { victim, by } of this.game.lifeEnds(events)) {
        const killer = by === null ? undefined : this.people.get(by);
        const credit = killer === undefined ? undefined : this.places.get(killer);
        if (credit) credit.kills++;
        const userId = this.people.get(victim);
        if (userId !== undefined) this.endLife(userId, by === null ? "edge" : "knockout");
      }
    }
    if (frames.size === 0) return;
    for (const place of this.places.values()) {
      const frame = place.socket ? frames.get(place.person) : undefined;
      if (place.socket && frame) this.send(place.socket, frame);
    }
  }

  private housekeeping(now: number): void {
    for (const [ws, c] of this.connections) {
      if (c.userId === null && now - c.connectedAt > HELLO_MS) this.refuse(ws, "hello_timeout");
      else if (c.person !== null && now - c.lastHeard > SILENT_MS) this.drop(ws);
    }
    for (const [userId, place] of this.places) {
      if (place.awaySince !== null && now - place.awaySince > AWAY_MS) {
        if (this.host && this.game?.engine.alive(this.host.world, place.person)) {
          this.endLife(userId, "left");
        }
        this.host?.leave(place.person);
        this.places.delete(userId);
        this.people.delete(place.person);
      }
    }
    if (now - this.reportedAt > REPORT_MS) this.report();
    if (this.connections.size === 0 && this.places.size === 0 && this.loop) {
      clearInterval(this.loop);
      this.loop = null;
      this.report();
    }
  }

  /** An account's life is over: it goes in the next report (a guest's doesn't). */
  private endLife(userId: string, end: LifeReport["end"]): void {
    const place = this.places.get(userId);
    if (!place || !this.host || !this.game) return;
    const result = this.game.engine.result(this.host.world, place.person);
    const kills = place.kills;
    place.kills = 0;
    if (place.guest || !result) return;
    this.lives.push({
      life: `${this.name}:${this.instance}:${String(place.person)}:${String(this.host.tick)}`,
      userId,
      arena: this.name,
      score: Math.round(result.score ?? 0),
      kills,
      durationMs: Math.round(result.timeMs ?? 0),
      end,
    });
  }

  /** Tells the game's directory how many people are here (on change, and every 30 s). */
  private report(): void {
    const people = this.places.size;
    if (people === this.reportedPeople && Date.now() - this.reportedAt < REPORT_MS) return;
    this.reportedPeople = people;
    this.reportedAt = Date.now();
    const directory = this.env.DIRECTORY.getByName(this.gameId);
    this.ctx.waitUntil(directory.report(this.name, people).catch(() => undefined));
  }

  /** The socket is gone: its player's place is kept for AWAY_MS. */
  private drop(ws: WebSocket): void {
    const connection = this.connections.get(ws);
    this.connections.delete(ws);
    try {
      ws.close(1000);
    } catch {
      // Already closed.
    }
    if (connection?.userId) {
      const place = this.places.get(connection.userId);
      if (place?.socket === ws) {
        place.socket = null;
        place.awaySince = Date.now();
      }
    }
  }

  private send(ws: WebSocket, data: Uint8Array<ArrayBuffer> | string): void {
    try {
      ws.send(data);
    } catch {
      this.drop(ws);
    }
  }

  private sendText(ws: WebSocket, value: object): void {
    this.send(ws, JSON.stringify(value));
  }

  /** An error frame, then the socket closes (the client closes it at once on its side). */
  private refuse(ws: WebSocket, code: ArenaErrorCode, keepPlace = true): void {
    this.sendText(ws, { t: "error", code });
    if (keepPlace) {
      this.drop(ws);
      return;
    }
    // Replaced by another tab: the place moves to the new socket, so only this one goes.
    this.connections.delete(ws);
    try {
      ws.close(4001, code);
    } catch {
      // Already closed.
    }
  }
}
