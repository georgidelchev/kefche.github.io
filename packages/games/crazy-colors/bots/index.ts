// Crazy Colors bots (SPEC §9.5: card games are rule-based, with a feel for
// the odds). They see only their own hand (a view).
// - Easy: any card that fits, now and then a draw instead.
// - Medium: keeps Wilds for last, plays a matching card of the colour it
//   holds most, names that colour with a Wild, and plays a drawn card that fits.
// - Hard: also saves Skip and +2 for a next player close to going out, and
//   prefers cards that change the colour to its own.
import type { Bot, GameBots, Rng } from "@kefche/game-sdk";

import { engine, face, type Action, type Colour, type State } from "../engine";

/** The colour this hand holds most of (Wilds don't count). */
function favourite(hand: readonly number[]): Colour {
  const counts = [0, 0, 0, 0];
  for (const id of hand) {
    const c = face(id).colour;
    if (c !== null) counts[c] = (counts[c] ?? 0) + 1;
  }
  return counts.indexOf(Math.max(...counts)) as Colour;
}

function score(state: State, seat: number, action: Action, careful: boolean): number {
  if ("keep" in action) return -5;
  if ("draw" in action) return -10;
  const f = face(action.play);
  const hand = state.hands[seat] ?? [];
  const mine = favourite(hand.filter((c) => c !== action.play));
  const nextSeat = (((seat + state.dir) % state.players) + state.players) % state.players;
  const nextCards = state.hands[nextSeat]?.length ?? 7;
  let value = 10;
  if (f.kind === "wild") value = action.colour === mine ? 2 : 0;
  else if (f.colour === mine) value += 3;
  if (f.kind === "number") value += f.n / 10;
  if (f.kind === "skip" || f.kind === "plus2") {
    value += careful ? (nextCards <= 2 ? 8 : -2) : 2;
  }
  if (careful && f.kind !== "wild" && f.colour !== state.colour && f.colour === mine) value += 2;
  return value;
}

const thinker = (careful: boolean): Bot<State, Action> => ({
  choose(state, seat, { rng }) {
    const actions = engine.legalActions(state, seat);
    let best = actions[0] ?? { keep: true };
    let bestScore = -Infinity;
    for (const action of actions) {
      const s = score(state, seat, action, careful) + rng.next() * 0.01;
      if (s > bestScore) {
        bestScore = s;
        best = action;
      }
    }
    return best;
  },
});

const pick = (rng: Rng, actions: readonly Action[]): Action => rng.pick(actions);

const easy: Bot<State, Action> = {
  choose(state, seat, { rng }) {
    const actions = engine.legalActions(state, seat);
    const plays = actions.filter((a) => "play" in a);
    if (plays.length > 0 && rng.next() < 0.8) return pick(rng, plays);
    return pick(rng, actions);
  },
};

export const bots: GameBots<State, Action> = {
  easy,
  medium: thinker(false),
  hard: thinker(true),
};
