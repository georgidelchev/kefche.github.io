// One table (Phase 12, ADR-0047): a Durable Object holding a room's match
// of a game with hidden information. It deals from a seed it draws itself
// and publishes only the seed's hash until the end, checks every action with
// the engine, plays the bots (and a stand-in for a player who has been gone
// 15 s, SPEC §10.5 as the owner decided, Q4), keeps the clocks, and sends
// each seat only its own view. When the match ends it reveals the seed and
// reports the moves to submit-match, which replays and records them.
//
// It sleeps between moves (the WebSocket Hibernation API): the match lives
// in storage, written once per change, sockets keep who they are in their
// attachments, pings are answered without waking it, and its only timer is
// the alarm for the next clock to run out or stand-in to start.
import { DurableObject } from "cloudflare:workers";

import {
  BOT_BUDGET_MS,
  BOT_MIN_THINK_MS,
  Rng,
  TABLE_PING,
  TABLE_PONG,
  TABLE_PROTOCOL_VERSION,
  createTimers,
  elapse,
  endTurn,
  expiryRule,
  isExpired,
  isSideAction,
  legalMove,
  parseTableText,
  roomBotDifficulty,
  roomConfig,
  roomTimer,
  startTurn,
  tableClientText,
  timeLeft,
  viewFor,
  type BotDifficulty,
  type GameResult,
  type TableErrorCode,
  type TableServerText,
  type TableState,
  type TimerPreset,
  type TimerState,
  type TurnMove,
} from "@kefche/game-sdk";

import { readyLexicons } from "./lexicons";
import { tableEntry, type TableRoom } from "./table-entry";
import { reportTable } from "./table-report";
import { TABLE_GAMES, type TableGame } from "./tables";

import type { Env } from "./env";

const HELLO_MS = 5000;
/** A player gone this long while it's their turn gets a stand-in bot. */
const STAND_IN_MS = 15_000;
/** A stand-in plays at this difficulty. */
const STAND_IN: BotDifficulty = "easy";
/** Messages a socket may send in a second before it's closed. */
const FLOOD_PER_SECOND = 20;
/** A finished table answers late joiners this long, then forgets the match. */
const KEEP_MS = 60 * 60_000;
/** At most this many bot moves in a row, a guard against a game that never ends. */
const MAX_BOT_MOVES = 1000;
/**
 * Side actions a seat may take in one match. Sea Battle's placing, the most
 * a game needs, takes a few dozen; endless ones could grow the saved match
 * past what Durable Object storage holds (2 MB a value).
 */
const MAX_SIDE_ACTIONS = 200;
/**
 * Workers don't advance the clock while code runs, so a bot's clock moves
 * this many milliseconds each time it's read: its budget is a number of
 * steps, not time. A table's bots get a tenth of a browser's budget.
 */
const BOT_CLOCK_STEP_MS = 0.1;
const BOT_BUDGET_SHARE = 0.1;

interface Match {
  /** "<room>/<room's match seed>", the object's name. */
  name: string;
  room: TableRoom;
  seed: string;
  commit: string;
  state: unknown;
  moves: TurnMove<unknown>[];
  timers: number[];
  /**
   * When the clocks of the seats to move were last brought up to date. Ahead
   * of now while browsers are still showing bot moves.
   */
  tickAt: number;
  /** Per seat: since when no socket of its player is open (null: connected; bots too). */
  awaySince: (number | null)[];
  standIn: boolean[];
  timedOut: number | null;
  endedAt: number | null;
  reported: boolean;
  /** Per seat: side actions taken so far (missing in matches saved before the budget). */
  sideActions?: number[];
}

/** Who a socket is, kept across hibernation. */
interface Attachment {
  userId: string | null;
  /** null: a spectator (or not welcomed yet). */
  seat: number | null;
  welcomed: boolean;
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export class Table extends DurableObject<Env> {
  private match: Match | null = null;
  /** The match being set up by the first player to arrive, for anyone arriving meanwhile. */
  private creating: Promise<Match> | null = null;
  private readonly frames = new WeakMap<WebSocket, { count: number; since: number }>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(TABLE_PING, TABLE_PONG));
    void ctx.blockConcurrencyWhile(async () => {
      this.match = (await ctx.storage.get<Match>("match")) ?? null;
    });
  }

  override fetch(request: Request): Response {
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);
    const name = new URL(request.url).pathname.split("/").slice(2, 4).join("/");
    // No hello in time: closed (a short timer; the table sleeps again after it).
    setTimeout(() => {
      if (!this.attachment(server).welcomed) this.refuse(server, "hello_timeout");
    }, HELLO_MS);
    server.serializeAttachment({ userId: null, seat: null, welcomed: false, name });
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (this.flooding(ws)) {
      this.refuse(ws, "closing");
      return;
    }
    if (typeof message !== "string") {
      this.refuse(ws, "hello_expected");
      return;
    }
    const text = parseTableText(tableClientText, message);
    const me = this.attachment(ws);
    if (text?.t === "hello" && !me.welcomed) {
      await this.hello(ws, text.v, text.token, text.room, text.match);
      return;
    }
    if (text?.t !== "act" || !me.welcomed) {
      this.refuse(ws, "hello_expected");
      return;
    }
    const match = this.match;
    const game = match ? TABLE_GAMES[match.room.gameId] : undefined;
    if (!match || !game || me.seat === null) return;
    await readyLexicons(game.manifest);
    const now = Date.now();
    this.catchUp(match, game, now);
    const expired = this.expireDue(match, game, now);
    // Stale (another move came first) or not legal: this player gets the match as it is.
    if (text.n !== match.moves.length || !this.legal(match, game, me.seat, text.action)) {
      if (!expired) this.sendState(ws, match, game, now);
      await this.settle(match, game, now, expired);
      return;
    }
    // A player who acts is back, whatever a stand-in was doing.
    match.standIn[me.seat] = false;
    this.apply(match, game, me.seat, text.action);
    await this.settle(match, game, now, true);
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    await this.gone(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.gone(ws);
  }

  override async alarm(): Promise<void> {
    const match = this.match;
    if (!match) return;
    const now = Date.now();
    if (match.endedAt !== null && now - match.endedAt >= KEEP_MS) {
      for (const ws of this.ctx.getWebSockets()) this.refuse(ws, "closing");
      this.match = null;
      await this.ctx.storage.deleteAll();
      return;
    }
    const game = TABLE_GAMES[match.room.gameId];
    if (!game) return;
    await readyLexicons(game.manifest);
    this.catchUp(match, game, now);
    const changed = this.expireDue(match, game, now);
    await this.settle(match, game, now, changed);
  }

  // ----------------------------------------------------------------- joining

  private async hello(
    ws: WebSocket,
    version: number,
    token: string,
    room: string,
    matchSeed: string,
  ): Promise<void> {
    if (version !== TABLE_PROTOCOL_VERSION) {
      this.refuse(ws, "version");
      return;
    }
    const name = (ws.deserializeAttachment() as { name?: string } | null)?.name ?? "";
    if (name !== `${room}/${matchSeed}`) {
      this.refuse(ws, "not_in_room");
      return;
    }
    const entry = await tableEntry(this.env, token, room, matchSeed);
    if (typeof entry === "string") {
      this.refuse(ws, entry);
      return;
    }
    const game = TABLE_GAMES[entry.gameId];
    if (game?.manifest.version !== entry.gameVersion) {
      this.refuse(ws, "unknown_game");
      return;
    }
    await readyLexicons(game.manifest);
    // The first to arrive sets the match up, from the room's row.
    this.creating ??= this.match ? Promise.resolve(this.match) : this.create(name, entry, game);
    const match = (this.match ??= await this.creating);
    const seat = entry.seat !== null && entry.seat < match.room.players ? entry.seat : null;
    // One socket per player: another tab takes over.
    for (const other of this.ctx.getWebSockets()) {
      const them = this.attachment(other);
      if (other !== ws && them.welcomed && them.userId === entry.userId) {
        this.refuse(other, "replaced");
      }
    }
    ws.serializeAttachment({ userId: entry.userId, seat, welcomed: true } satisfies Attachment);
    const now = Date.now();
    if (seat !== null) {
      match.awaySince[seat] = null;
      match.standIn[seat] = false;
    }
    this.send(ws, { t: "welcome", seat, commit: match.commit });
    this.catchUp(match, game, now);
    await this.settle(match, game, now, true);
  }

  private async create(name: string, entry: TableRoom, game: TableGame): Promise<Match> {
    const seed = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
    const { players, botSeats, settings } = entry;
    const now = Date.now();
    const config = roomConfig(game.manifest.options, settings.options ?? {});
    const timer = roomTimer(game.manifest, settings.timer ?? 0);
    const state = game.engine.initialState(config, players, seed);
    let timers = createTimers(timer, players).remainingMs;
    for (const s of game.engine.currentSeats(state)) {
      timers = startTurn(timer, { remainingMs: timers }, s).remainingMs;
    }
    return {
      name,
      room: entry,
      seed,
      commit: await sha256(seed),
      state,
      moves: [],
      timers: [...timers],
      tickAt: now,
      // Everyone counts as away until they connect, so a no-show gets a stand-in too.
      awaySince: Array.from({ length: players }, (_, i) => (botSeats.includes(i) ? null : now)),
      standIn: Array.from({ length: players }, () => false),
      timedOut: null,
      endedAt: null,
      reported: false,
    };
  }

  private async gone(ws: WebSocket): Promise<void> {
    const me = this.attachment(ws);
    try {
      ws.close(1000);
    } catch {
      // Already closed.
    }
    const match = this.match;
    if (!match || me.seat === null || !me.welcomed) return;
    const still = this.ctx
      .getWebSockets()
      .some((other) => other !== ws && this.attachment(other).userId === me.userId);
    if (still) return;
    match.awaySince[me.seat] = Date.now();
    const game = TABLE_GAMES[match.room.gameId];
    if (!game) return;
    await readyLexicons(game.manifest);
    await this.settle(match, game, Date.now(), true);
  }

  // ----------------------------------------------------------------- the match

  private timer(match: Match, game: TableGame): TimerPreset {
    return roomTimer(game.manifest, match.room.settings.timer ?? 0);
  }

  private isBot(match: Match, seat: number): boolean {
    return match.room.botSeats.includes(seat);
  }

  private result(match: Match, game: TableGame): GameResult | null {
    if (match.timedOut !== null) {
      return (
        game.engine.timeoutResult?.(match.state, match.timedOut) ?? {
          completed: true,
          outcome: Array.from({ length: match.room.players }, (_, i) =>
            i === match.timedOut ? 0 : 1,
          ),
        }
      );
    }
    return game.engine.result(match.state);
  }

  private toMove(match: Match, game: TableGame): number[] {
    return this.result(match, game) ? [] : game.engine.currentSeats(match.state);
  }

  /** Runs the clocks of the seats to move up to now. */
  private catchUp(match: Match, game: TableGame, now: number): void {
    const timer = this.timer(match, game);
    if (now <= match.tickAt) return;
    const passed = now - match.tickAt;
    match.tickAt = now;
    if (timer.kind === "none") return;
    const waiting = this.toMove(match, game);
    const counted = timer.kind === "countdown" ? waiting.slice(0, 1) : waiting;
    let timers: TimerState = { remainingMs: match.timers };
    for (const s of counted) timers = elapse(timer, timers, s, passed);
    match.timers = [...timers.remainingMs];
  }

  private legal(match: Match, game: TableGame, seat: number, action: unknown): boolean {
    if (isSideAction(game.engine, match.state, seat, action)) {
      // Side actions don't move a game on (moving a Sea Battle ship again),
      // so each seat has a budget: endless ones would grow the saved match
      // past what storage takes, and the table would stall for everyone.
      const used = match.sideActions?.[seat] ?? 0;
      if (used >= MAX_SIDE_ACTIONS) return false;
      match.sideActions = Array.from({ length: match.room.players }, (_, i) =>
        i === seat ? used + 1 : (match.sideActions?.[i] ?? 0),
      );
      return true;
    }
    if (!this.toMove(match, game).includes(seat)) return false;
    return legalMove(game.engine, match.state, seat, action) !== undefined;
  }

  /** A legal action, already checked: applied, with the clocks of whoever moves next started. */
  private apply(match: Match, game: TableGame, seat: number, action: unknown): void {
    const timer = this.timer(match, game);
    const before = this.toMove(match, game);
    let timers = endTurn(timer, { remainingMs: match.timers }, seat);
    match.state = game.engine.applyAction(match.state, seat, action);
    match.moves.push({ seat, action });
    for (const s of this.toMove(match, game)) {
      if (s === seat || !before.includes(s)) timers = startTurn(timer, timers, s);
    }
    match.timers = [...timers.remainingMs];
  }

  /** A random legal move for `seat`, seeded by the move number. */
  private randomAction(match: Match, game: TableGame, seat: number): unknown {
    const actions = game.engine.legalActions(match.state, seat);
    return actions.length > 0
      ? Rng.fromSeed(`${match.seed}:auto:${String(match.moves.length)}`).pick(actions)
      : undefined;
  }

  /**
   * Clocks run out (the timer's rule), and players gone long enough get a
   * stand-in. True when that changed anything.
   */
  private expireDue(match: Match, game: TableGame, now: number): boolean {
    const timer = this.timer(match, game);
    let changed = false;
    for (const seat of this.toMove(match, game)) {
      if (this.isBot(match, seat) || match.standIn[seat]) continue;
      const since = match.awaySince[seat];
      if (since !== null && since !== undefined && now - since >= STAND_IN_MS) {
        match.standIn[seat] = true;
        changed = true;
        continue;
      }
      if (!isExpired(timer, { remainingMs: match.timers }, seat)) continue;
      const rule = expiryRule(timer);
      const action =
        rule === "random-move" || rule === "pass"
          ? this.randomAction(match, game, seat)
          : undefined;
      if (action !== undefined) this.apply(match, game, seat, action);
      else match.timedOut = seat;
      changed = true;
      if (this.result(match, game)) break;
    }
    return changed;
  }

  /** Bots and stand-ins move until it's a person's turn; browsers show each move in turn. */
  private playBots(match: Match, game: TableGame, now: number): void {
    let played = 0;
    while (played < MAX_BOT_MOVES && !this.result(match, game)) {
      const seat = this.toMove(match, game).find((s) => this.isBot(match, s) || match.standIn[s]);
      if (seat === undefined) break;
      const difficulty = match.standIn[seat]
        ? STAND_IN
        : roomBotDifficulty(game.manifest, match.room.settings.bots?.[String(seat)]);
      let action: unknown;
      try {
        const bot = game.bots[difficulty];
        let clock = 0;
        action = bot?.choose(viewFor(game.engine, match.state, seat), seat, {
          rng: Rng.fromSeed(`${match.seed}:bot:${String(match.moves.length)}`),
          deadline: BOT_BUDGET_MS[difficulty] * BOT_BUDGET_SHARE,
          now: () => (clock += BOT_CLOCK_STEP_MS),
        });
      } catch (e) {
        console.error("table: bot failed", { game: match.room.gameId, error: String(e) });
      }
      if (!this.legal(match, game, seat, action)) action = this.randomAction(match, game, seat);
      if (action === undefined) break;
      this.apply(match, game, seat, action);
      played++;
    }
    // The next person's clock starts once their browser has shown these moves.
    if (played > 0) match.tickAt = Math.max(match.tickAt, now + played * BOT_MIN_THINK_MS);
  }

  /** After any change: bots move, everyone hears, it's saved, the next alarm is set. */
  private async settle(
    match: Match,
    game: TableGame,
    now: number,
    changed: boolean,
  ): Promise<void> {
    if (changed) {
      this.playBots(match, game, now);
      const over = this.result(match, game) !== null;
      if (over && match.endedAt === null) match.endedAt = now;
      for (const ws of this.ctx.getWebSockets()) {
        if (this.attachment(ws).welcomed) this.sendState(ws, match, game, now);
      }
      if (over && !match.reported) {
        match.reported = true;
        this.ctx.waitUntil(
          reportTable(this.env, {
            roomId: match.room.roomId,
            match: match.room.settings.seed,
            gameId: match.room.gameId,
            version: game.manifest.version,
            seed: match.seed,
            moves: match.moves,
            timedOut: match.timedOut,
          }),
        );
      }
      await this.ctx.storage.put("match", match);
    }
    await this.schedule(match, game, now);
  }

  /** The alarm: the next clock to run out, stand-in to start, or the end of keeping the match. */
  private async schedule(match: Match, game: TableGame, now: number): Promise<void> {
    const clocks = { remainingMs: match.timers };
    let due = Infinity;
    if (match.endedAt !== null) {
      due = match.endedAt + KEEP_MS;
    } else {
      const timer = this.timer(match, game);
      const from = Math.max(match.tickAt, now);
      for (const seat of this.toMove(match, game)) {
        if (this.isBot(match, seat) || match.standIn[seat]) continue;
        const left = timeLeft(timer, clocks, seat);
        if (left !== null) due = Math.min(due, from + left);
        const since = match.awaySince[seat];
        if (since !== null && since !== undefined) due = Math.min(due, since + STAND_IN_MS);
      }
    }
    const current = await this.ctx.storage.getAlarm();
    if (due === Infinity) {
      if (current !== null) await this.ctx.storage.deleteAlarm();
    } else if (current !== Math.ceil(due)) {
      await this.ctx.storage.setAlarm(Math.ceil(due));
    }
  }

  // ----------------------------------------------------------------- sending

  private sendState(ws: WebSocket, match: Match, game: TableGame, now: number): void {
    const { seat } = this.attachment(ws);
    const result = this.result(match, game);
    const timer = this.timer(match, game);
    const toMove = this.toMove(match, game);
    const last = match.moves.at(-1);
    const shown = last
      ? game.engine.viewAction
        ? game.engine.viewAction(last.action, last.seat, seat)
        : last.action
      : null;
    const lag = Math.max(0, now - match.tickAt);
    const state: TableState = {
      t: "state",
      n: match.moves.length,
      // Over: everything is shown.
      view: result ? match.state : viewFor(game.engine, match.state, seat),
      toMove,
      clocks: Array.from({ length: match.room.players }, (_, i) => {
        const left = timeLeft(timer, { remainingMs: match.timers }, i);
        return left === null ? null : Math.max(0, left - (toMove.includes(i) ? lag : 0));
      }),
      last: last ? { seat: last.seat, action: shown } : null,
      away: match.awaySince.map((since) => since !== null),
      standIn: [...match.standIn],
      result: result
        ? {
            completed: result.completed,
            ...(result.outcome
              ? { outcome: result.outcome.map((o) => (o >= 1 ? 1 : o > 0 ? 0.5 : 0)) }
              : {}),
          }
        : null,
      timedOut: match.timedOut,
    };
    this.send(ws, state);
    if (result) this.send(ws, { t: "over", seed: match.seed });
  }

  private send(ws: WebSocket, value: TableServerText): void {
    try {
      ws.send(JSON.stringify(value));
    } catch {
      // Closing; webSocketClose follows.
    }
  }

  private attachment(ws: WebSocket): Attachment {
    const a = ws.deserializeAttachment() as Partial<Attachment> | null;
    return { userId: a?.userId ?? null, seat: a?.seat ?? null, welcomed: a?.welcomed ?? false };
  }

  private flooding(ws: WebSocket): boolean {
    const now = Date.now();
    const f = this.frames.get(ws) ?? { count: 0, since: now };
    if (now - f.since >= 1000) {
      f.count = 0;
      f.since = now;
    }
    f.count++;
    this.frames.set(ws, f);
    return f.count > FLOOD_PER_SECOND;
  }

  /** An error frame, then the socket closes. */
  private refuse(ws: WebSocket, code: TableErrorCode): void {
    this.send(ws, { t: "error", code });
    try {
      ws.close(4001, code);
    } catch {
      // Already closed.
    }
  }
}
