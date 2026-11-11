// Who's the Spy has no bots to play against: it's a game of talk (SPEC
// §20.4, Phase 12). This is only the stand-in the table uses for a player
// who has been gone a while (ADR-0047): it says it's ready, votes for
// someone at random, and, as the spy, guesses at random. The manifest
// offers no bots, so nobody picks it.
import type { Bot, GameBots } from "@kefche/game-sdk";

import { engine, type Action, type State } from "../engine";

const standIn: Bot<State, Action> = {
  choose(s, seat, { rng }) {
    const actions = engine.legalActions(s, seat);
    return rng.pick(actions);
  },
};

export const bots: GameBots<State, Action> = { easy: standIn };
