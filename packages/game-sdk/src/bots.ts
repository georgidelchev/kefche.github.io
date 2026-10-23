// Bot contract (SPEC §9.5). A bot is a pure strategy: it gets the state, its
// seat, a seeded Rng and a deadline, and returns one legal action. The browser
// runtime runs bots in a Web Worker; the same code runs in tests and on the
// server (bots in online rooms are simulated by the host, Phase 5).

import type { BotDifficulty } from "./manifest";
import type { Rng } from "./prng";

export interface BotContext {
  /** Randomness for tie-breaks and deliberate mistakes; seeded per move. */
  rng: Rng;
  /** A `now()` value to answer by. Search deeper while time remains. */
  deadline: number;
  now: () => number;
}

export interface Bot<State, Action> {
  choose(state: State, seat: number, context: BotContext): Action;
}

/** What a game's bots module exports: one bot per difficulty it declares. */
export type GameBots<State, Action> = Readonly<Partial<Record<BotDifficulty, Bot<State, Action>>>>;

/** Thinking time per difficulty. Slow phones search less deep, never longer. */
export const BOT_BUDGET_MS: Readonly<Record<BotDifficulty, number>> = {
  easy: 150,
  medium: 400,
  hard: 900,
};

/** A bot move never appears sooner than this, so players can follow it. */
export const BOT_MIN_THINK_MS = 400;
