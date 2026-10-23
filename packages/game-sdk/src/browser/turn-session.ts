// Turn-based match runtime (SPEC §9.5, §11) for solo vs bots and hotseat. It
// owns whose turn it is, asks the game's bot worker for bot moves, runs the
// clocks and applies the timer's expiry rule, and reports to the player's
// HUD. Games render the state and pass human moves to `act()`.

import { BOT_BUDGET_MS, BOT_MIN_THINK_MS } from "../bots";
import { replayTurns, type GameResult, type TurnEngine, type TurnMove } from "../engines";
import { Rng } from "../prng";
import {
  createTimers,
  elapse,
  endTurn,
  expiryRule,
  isExpired,
  isLowTime,
  startTurn,
  timeLeft,
} from "../timers";

import type { BotDifficulty } from "../manifest";
import type { GameContext } from "./game-module";

export interface TurnView<State, Action> {
  state: State;
  /** Seats to move now; empty once the match is over. */
  toMove: readonly number[];
  /** The person who may act now, or null (a bot's turn, paused or over). */
  humanSeat: number | null;
  /** A bot is choosing its move. */
  thinking: boolean;
  lastMove: TurnMove<Action> | null;
  result: GameResult | null;
  canUndo: boolean;
}

export interface TurnSessionOptions<State, Action, Config> {
  engine: TurnEngine<State, Action, Config>;
  config: Config;
  /** Needs `context.match`; reports go to `context.report`. */
  context: GameContext;
  /**
   * `() => new Worker(new URL("./bots.worker.ts", import.meta.url), { type: "module" })`,
   * a worker that calls `serveBots()`. Written at the call site for the bundler.
   */
  createBotWorker: () => Worker;
  /** The action for the "pass" expiry rule; without it, running out of time loses. */
  passAction?: (state: State, seat: number) => Action;
  /** Lets the person take back moves against bots (not with clocks). */
  allowUndo?: boolean;
  onChange: (view: TurnView<State, Action>) => void;
  /** Seats this browser plays (online: your own); by default every person's seat. */
  localSeats?: readonly number[];
  /** Start from a snapshot instead of a new match (a new host taking over). */
  from?: TurnSnapshot<State, Action>;
  /** After every change, with the full match: the online host shares it. */
  onSnapshot?: (snapshot: TurnSnapshot<State, Action>) => void;
  /** Online: is the person in this seat away? Their turns are skipped (SPEC §10.5). */
  isAway?: (seat: number) => boolean;
}

/** Everything needed to show a match, or to carry it on from here. */
export interface TurnSnapshot<State, Action> {
  /** Moves (and skipped turns) so far. */
  moves: number;
  state: State;
  /** Milliseconds left per timer slot (TimerState.remainingMs). */
  timers: readonly number[];
  last: TurnMove<Action> | null;
  /** A result the engine doesn't know about: someone lost on time. */
  timeout: GameResult | null;
}

export interface TurnSession<Action> {
  /** A person's move; false when it isn't theirs to make or isn't legal. */
  act(seat: number, action: Action): boolean;
  /** Takes back the last move by a person, and the bot replies after it. */
  undo(): void;
  pause(): void;
  resume(): void;
  /** Look again at who is away (online presence changed). */
  refresh(): void;
  destroy(): void;
}

/** Sent to the bot worker. */
export interface BotRequest {
  id: number;
  state: unknown;
  seat: number;
  difficulty: BotDifficulty;
  seed: string;
  budgetMs: number;
}

export type BotReply =
  { id: number; ok: true; action: unknown } | { id: number; ok: false; error: string };

const TICK_MS = 100;
/** An away player's turn is skipped after this grace, in case they're back at once. */
const AWAY_SKIP_MS = 3000;
const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** One long-lived worker; a new request or a cancel drops the one in flight. */
function createBotClient(create: () => Worker) {
  let worker: Worker | null = null;
  let nextId = 0;
  let pending: {
    id: number;
    resolve: (action: unknown) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  const drop = (error: Error) => {
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.reject(error);
    pending = null;
    // Stops a search that is still running.
    worker?.terminate();
    worker = null;
  };
  const ensure = (): Worker => {
    if (worker) return worker;
    const created = create();
    created.onmessage = (event: MessageEvent<BotReply>) => {
      if (event.data.id !== pending?.id) return;
      clearTimeout(pending.timer);
      const { resolve, reject } = pending;
      pending = null;
      if (event.data.ok) resolve(event.data.action);
      else reject(new Error(event.data.error));
    };
    created.onerror = (event) => {
      event.preventDefault();
      drop(new Error(event.message));
    };
    worker = created;
    return created;
  };

  return {
    choose(request: Omit<BotRequest, "id">): Promise<unknown> {
      drop(new Error("superseded"));
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => {
          drop(new Error(`Bot exceeded ${String(request.budgetMs + 1000)} ms`));
        }, request.budgetMs + 1000);
        pending = { id, resolve, reject, timer };
        ensure().postMessage({ ...request, id } satisfies BotRequest);
      });
    },
    cancel() {
      drop(new Error("cancelled"));
    },
    dispose() {
      drop(new Error("disposed"));
      worker?.terminate();
      worker = null;
    },
  };
}

export function createTurnSession<State, Action, Config>(
  options: TurnSessionOptions<State, Action, Config>,
): TurnSession<Action> {
  const { engine, config, context } = options;
  const { match, seed } = context;
  if (!match) throw new Error("createTurnSession needs context.match");
  const { seats, timer } = match;

  const resumed = options.from;
  let state = resumed ? resumed.state : engine.initialState(config, seats.length, seed);
  /** This session's own moves, for undo (none of a match it took over). */
  let moves: TurnMove<Action>[] = [];
  /** Moves and skipped turns in the whole match; seeds bots and random moves. */
  let count = resumed?.moves ?? 0;
  let lastMove: TurnMove<Action> | null = resumed?.last ?? null;
  let timers = resumed ? { remainingMs: [...resumed.timers] } : createTimers(timer, seats.length);
  /** Set when someone loses on time; the engine doesn't know about clocks. */
  let timeout: GameResult | null = resumed?.timeout ?? null;
  let paused = false;
  let destroyed = false;
  let finished = false;
  let thinking = false;
  /** Bumped to forget a bot answer that is still on its way. */
  let request = 0;
  let last = performance.now();
  const bots = createBotClient(options.createBotWorker);

  const result = () => timeout ?? engine.result(state);
  const toMove = () => (result() ? [] : engine.currentSeats(state));
  const mover = () => toMove()[0];
  const canUndo = () =>
    Boolean(options.allowUndo) &&
    match.mode === "solo-bots" &&
    timer.kind !== "clock" &&
    !paused &&
    !result() &&
    moves.some((m) => seats[m.seat]?.kind === "human");

  const report = () => {
    const seatsToMove = toMove();
    context.report({
      type: "turn",
      toMove: seatsToMove,
      clocks: seats.map((_, i) => timeLeft(timer, timers, i)),
      lowTime: seats.map((_, i) => seatsToMove.includes(i) && isLowTime(timer, timers, i)),
      thinking,
    });
  };
  const plays = (seat: number) =>
    seats[seat]?.kind === "human" && (options.localSeats?.includes(seat) ?? true);
  const emit = () => {
    const seatsToMove = toMove();
    const next = seatsToMove[0];
    options.onChange({
      state,
      toMove: seatsToMove,
      humanSeat: next !== undefined && plays(next) && !paused && !destroyed ? next : null,
      thinking,
      lastMove,
      result: result(),
      canUndo: canUndo(),
    });
    options.onSnapshot?.({
      moves: count,
      state,
      timers: timers.remainingMs,
      last: lastMove,
      timeout,
    });
    report();
    const over = result();
    if (over && !finished) {
      finished = true;
      context.report({ type: "finish", result: over });
    }
  };

  /** Seeded by the move number, so a replay makes the same choice. */
  const randomAction = (seat: number): Action | undefined => {
    const actions = engine.legalActions(state, seat);
    return actions.length > 0
      ? Rng.fromSeed(`${seed}:auto:${String(count)}`).pick(actions)
      : undefined;
  };

  const advance = (next: State, move: TurnMove<Action> | null, seat: number) => {
    timers = endTurn(timer, timers, seat);
    state = next;
    count++;
    lastMove = move;
    if (move) moves = [...moves, move];
    const following = mover();
    if (following !== undefined) timers = startTurn(timer, timers, following);
    emit();
    schedule();
  };

  const apply = (seat: number, action: Action): boolean => {
    const next = engine.applyAction(state, seat, action);
    if (next === state) return false;
    advance(next, { seat, action }, seat);
    return true;
  };

  /** The legal action equal to a bot's answer, which comes back as plain data. */
  const legal = (seat: number, answer: unknown): Action | undefined => {
    const wanted = JSON.stringify(answer);
    return engine.legalActions(state, seat).find((a) => JSON.stringify(a) === wanted);
  };

  function schedule(): void {
    if (paused || destroyed || result()) return;
    const seat = mover();
    if (seat === undefined) return;
    const player = seats[seat];
    if (player?.kind === "human") {
      skipIfAway(seat);
      return;
    }
    if (player?.kind !== "bot") return;
    const id = ++request;
    const started = performance.now();
    const budgetMs = BOT_BUDGET_MS[player.difficulty];
    thinking = true;
    emit();
    void bots
      .choose({
        state,
        seat,
        difficulty: player.difficulty,
        seed: `${seed}:bot:${String(count)}`,
        budgetMs,
      })
      .catch(() => undefined)
      .then(async (answer) => {
        const wait = BOT_MIN_THINK_MS - (performance.now() - started);
        if (wait > 0) await sleep(wait);
        if (id !== request || paused || destroyed) return;
        thinking = false;
        // A failed or illegal answer becomes a random legal move.
        const action = legal(seat, answer) ?? randomAction(seat);
        if (action === undefined || !apply(seat, action)) emit();
      });
  }

  const stopBot = () => {
    request++;
    bots.cancel();
    thinking = false;
  };

  /**
   * An away player's turn passes after a short grace (SPEC §10.5). With a
   * clock it doesn't: their clock keeps running and they lose on time.
   */
  let awayTimer: ReturnType<typeof setTimeout> | null = null;
  function skipIfAway(seat: number): void {
    if (awayTimer !== null) clearTimeout(awayTimer);
    awayTimer = null;
    if (!options.isAway?.(seat) || !engine.skipTurn || timer.kind === "clock") return;
    const at = count;
    awayTimer = setTimeout(() => {
      awayTimer = null;
      if (paused || destroyed || result() || count !== at || mover() !== seat) return;
      if (!options.isAway?.(seat)) return;
      const next = engine.skipTurn?.(state, seat) ?? state;
      if (next !== state) advance(next, null, seat);
    }, AWAY_SKIP_MS);
  }

  const expire = (seat: number) => {
    stopBot();
    const rule = expiryRule(timer);
    if (rule === "random-move") {
      const action = randomAction(seat);
      if (action !== undefined && apply(seat, action)) return;
    } else if (rule === "pass" && options.passAction) {
      if (apply(seat, options.passAction(state, seat))) return;
    }
    // "loss", or nothing to play: the seat loses and everyone else wins.
    timeout = { completed: true, outcome: seats.map((_, i) => (i === seat ? 0 : 1)) };
    emit();
  };

  const interval =
    timer.kind === "none"
      ? null
      : setInterval(() => {
          const now = performance.now();
          const passed = Math.round(now - last);
          last = now;
          if (paused || destroyed || result()) return;
          const seat = mover();
          if (seat === undefined) return;
          timers = elapse(timer, timers, seat, passed);
          if (isExpired(timer, timers, seat)) expire(seat);
          else report();
        }, TICK_MS);

  const first = mover();
  if (first !== undefined && !resumed) timers = startTurn(timer, timers, first);
  // After the caller has its session object, so onChange may use it.
  queueMicrotask(() => {
    if (destroyed) return;
    context.report({ type: "start" });
    emit();
    schedule();
  });

  return {
    act(seat, action) {
      if (paused || destroyed || result()) return false;
      if (seats[seat]?.kind !== "human" || !toMove().includes(seat)) return false;
      return apply(seat, action);
    },
    undo() {
      if (!canUndo()) return;
      stopBot();
      const index = moves.findLastIndex((m) => seats[m.seat]?.kind === "human");
      moves = moves.slice(0, index);
      count = moves.length;
      lastMove = moves.at(-1) ?? null;
      state = replayTurns(engine, config, seats.length, seed, moves);
      timers = createTimers(timer, seats.length);
      const next = mover();
      if (next !== undefined) timers = startTurn(timer, timers, next);
      emit();
      schedule();
    },
    pause() {
      if (paused || destroyed) return;
      paused = true;
      stopBot();
      emit();
    },
    resume() {
      if (!paused || destroyed) return;
      paused = false;
      last = performance.now();
      emit();
      schedule();
    },
    refresh() {
      if (!thinking) schedule();
    },
    destroy() {
      destroyed = true;
      request++;
      if (interval !== null) clearInterval(interval);
      if (awayTimer !== null) clearTimeout(awayTimer);
      bots.dispose();
    },
  };
}
