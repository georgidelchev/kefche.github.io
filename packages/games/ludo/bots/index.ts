// Ludo bots (SPEC §9.5). They see the whole board and the die; only the
// next roll is unknown.
// - Easy: any token that can move.
// - Medium: hits when it can, then brings a token out, then gets one home,
//   else moves the furthest.
// - Hard: also weighs danger: how many tokens of other colours stand one to
//   six squares behind where a token would land (or where it stands now).
import type { Bot, GameBots } from "@kefche/game-sdk";

import {
  HOME,
  YARD,
  destination,
  engine,
  isSafe,
  square,
  type Action,
  type State,
} from "../engine";

/** Tokens of other colours one to six squares behind a track square. */
function threats(s: State, seat: number, sq: number): number {
  let n = 0;
  s.tokens.forEach((list, other) => {
    if (other === seat) return;
    const oc = s.colours[other] ?? 0;
    for (const p of list) {
      if (p < 0 || p > 50) continue;
      const at = square(oc, p);
      const gap = (sq - at + 52) % 52;
      if (gap >= 1 && gap <= 6) n++;
    }
  });
  return n;
}

function score(s: State, seat: number, token: number, hard: boolean): number {
  const from = s.tokens[seat]?.[token] ?? YARD;
  const to = destination(s, seat, token) ?? from;
  const colour = s.colours[seat] ?? 0;
  let v = to / 4;
  if (to === HOME) v += 40;
  else if (to > 50) v += 20;
  if (from === YARD) v += 30;
  if (to <= 50) {
    const sq = square(colour, to);
    const hits = s.tokens.some(
      (list, other) =>
        other !== seat &&
        list.some((p) => p >= 0 && p <= 50 && square(s.colours[other] ?? 0, p) === sq),
    );
    if (hits && !isSafe(sq)) v += 50;
    if (hard && !isSafe(sq)) v -= threats(s, seat, sq) * 12;
  }
  if (hard && from >= 0 && from <= 50 && !isSafe(square(colour, from)))
    v += threats(s, seat, square(colour, from)) * 8;
  return v;
}

const thinker = (hard: boolean): Bot<State, Action> => ({
  choose(s, seat) {
    const actions = engine.legalActions(s, seat);
    let best = actions[0] ?? { token: 0 };
    let bestScore = -Infinity;
    for (const a of actions) {
      const v = score(s, seat, a.token, hard);
      if (v > bestScore) {
        bestScore = v;
        best = a;
      }
    }
    return best;
  },
});

const easy: Bot<State, Action> = {
  choose(s, seat, { rng }) {
    return rng.pick(engine.legalActions(s, seat));
  },
};

export const bots: GameBots<State, Action> = { easy, medium: thinker(false), hard: thinker(true) };
