// Lowest Unique Number bots (SPEC §9.5). They see every finished round's
// picks, never a pick still hidden.
// - Easy: picks at random, a little more often low.
// - Medium: picks low numbers more often, falling away by a fixed ratio,
//   the kind of spread that's hard to beat when everyone plays well.
// - Hard: learns how often each player picks each number (from every round
//   so far), plays a few hundred imagined rounds against that, and picks a
//   number by how often it would have won (the square of it), so two hard
//   bots don't think alike and collide.
import type { Bot, GameBots, Rng } from "@kefche/game-sdk";

import { MAX, lowestUnique, type Action, type State } from "../engine";

/** A number from 1 to MAX with weights falling by `ratio`. */
function falling(rng: Rng, ratio: number, top: number): number {
  const weights = Array.from({ length: top }, (_, i) => ratio ** i);
  let r = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < top; i++) {
    r -= weights[i] ?? 0;
    if (r <= 0) return i + 1;
  }
  return 1;
}

const easy: Bot<State, Action> = {
  choose: (s, _seat, { rng }) => ({ pick: falling(rng, 0.9, Math.min(MAX, s.players + 3)) }),
};

const medium: Bot<State, Action> = {
  choose: (s, _seat, { rng }) => ({ pick: falling(rng, 0.65, Math.min(MAX, s.players + 2)) }),
};

const hard: Bot<State, Action> = {
  choose(s, seat, { rng }) {
    if (s.history.length < 2 || rng.next() < 0.15)
      return medium.choose(s, seat, { rng, deadline: 0, now: () => 0 });
    // How often each other player picked each number, smoothed.
    const habits = Array.from({ length: s.players }, (_, p) => {
      const counts = Array.from({ length: MAX }, () => 0.5);
      for (const round of s.history) {
        const n = round.picks[p];
        if (n !== undefined) counts[n - 1] = (counts[n - 1] ?? 0) + 1;
      }
      return counts;
    });
    const draw = (counts: readonly number[]) => {
      let r = rng.next() * counts.reduce((a, b) => a + b, 0);
      for (let i = 0; i < counts.length; i++) {
        r -= counts[i] ?? 0;
        if (r <= 0) return i + 1;
      }
      return MAX;
    };
    const wins = Array.from({ length: MAX }, () => 0);
    for (let k = 0; k < 300; k++) {
      const others = habits.map((h, p) => (p === seat ? 0 : draw(h)));
      for (let n = 1; n <= MAX; n++) {
        const picks = others.map((o, p) => (p === seat ? n : o));
        if (lowestUnique(picks) === seat) wins[n - 1] = (wins[n - 1] ?? 0) + 1;
      }
    }
    // Not always the single best: two hard bots would pick alike and collide.
    return { pick: draw(wins.map((w) => w * w)) };
  },
};

export const bots: GameBots<State, Action> = { easy, medium, hard };
