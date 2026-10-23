// Worker side of the bot runtime: a game's `renderer/bots.worker.ts` calls
// `serveBots(bots)`. Each request carries the state, the seat, the difficulty,
// a seed for the bot's Rng and its time budget.

import { Rng } from "../prng";

import type { GameBots } from "../bots";
import type { BotReply, BotRequest } from "./turn-session";

export function serveBots<State, Action>(bots: GameBots<State, Action>): void {
  self.onmessage = (event: MessageEvent<BotRequest>) => {
    const { id, state, seat, difficulty, seed, budgetMs } = event.data;
    let reply: BotReply;
    try {
      const bot = bots[difficulty];
      if (!bot) throw new Error(`No bot for difficulty "${difficulty}"`);
      const start = performance.now();
      // The state comes from this game's own session, so it has the game's shape.
      const action = bot.choose(state as State, seat, {
        rng: Rng.fromSeed(seed),
        deadline: start + budgetMs,
        now: () => performance.now(),
      });
      reply = { id, ok: true, action };
    } catch (e) {
      reply = { id, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    self.postMessage(reply);
  };
}
