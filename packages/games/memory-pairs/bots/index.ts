// Memory Pairs bots (SPEC §9.5), Memory Match's own: each remembers the
// cards that have turned up, and forgets some. Easy keeps a card in mind
// with a chance of 35%, medium 70%, hard 95%; a known pair is taken at once,
// and a first card that matches one in mind is paired with it. Otherwise a
// card it hasn't seen. They see only views: what everyone saw turn up.
import {
  chooseFlip,
  RECALL,
  type Difficulty,
  type Memory,
} from "@kefche/game-memory-match/engine/bots";
import type { Bot, GameBots } from "@kefche/game-sdk";

import { UNSEEN, type Action, type State } from "../engine";

const bot = (level: Difficulty): Bot<State, Action> => ({
  choose(s, _seat, { rng }) {
    const memory: Memory = new Map();
    s.seen.forEach((symbol, card) => {
      if (symbol !== UNSEEN && !s.matched[card] && rng.next() < RECALL[level])
        memory.set(card, symbol);
    });
    // The cards up now are in plain sight.
    for (const card of s.up) {
      const symbol = s.symbols[card];
      if (symbol !== undefined && symbol !== UNSEEN) memory.set(card, symbol);
    }
    return { flip: chooseFlip(memory, s, rng) };
  },
});

export const bots: GameBots<State, Action> = {
  easy: bot("easy"),
  medium: bot("medium"),
  hard: bot("hard"),
};
