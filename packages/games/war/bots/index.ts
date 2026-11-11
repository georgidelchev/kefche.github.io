// War bots (SPEC §9.5): War has no choices, so a bot just flips its card.
import type { Bot, GameBots } from "@kefche/game-sdk";

import type { Action, State } from "../engine";

const flip: Bot<State, Action> = { choose: () => ({ flip: true }) };

export const bots: GameBots<State, Action> = { easy: flip };
