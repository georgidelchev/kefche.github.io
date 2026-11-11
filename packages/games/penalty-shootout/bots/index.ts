// Penalty Shootout bots (SPEC §9.5). They see every kick taken so far,
// never a choice still hidden.
// - Easy: shoots and dives at random.
// - Medium: shoots away from the column the other keeper dives to most,
//   and dives to the column the other shooter aims at most, with chance
//   mixed in.
// - Hard: weighs each spot by the chance of a goal against the keeper's
//   habits (counting the bar), and dives where the shooter's habits, last
//   kick included, point; enough chance stays in not to be read.
import type { Bot, GameBots, Rng } from "@kefche/game-sdk";

import {
  DIVES,
  SPOTS,
  columnOf,
  isHigh,
  keeperOf,
  overChance,
  shooterOf,
  type Action,
  type State,
} from "../engine";

/** How often `seat`, keeping, dived to each column (smoothed). */
function dives(s: State, keeper: number): number[] {
  const counts = [1, 1, 1];
  for (const k of s.kicks) if (k.shooter !== keeper) counts[k.dive] = (counts[k.dive] ?? 0) + 1;
  return counts;
}

/** How often `seat`, shooting, aimed at each column (smoothed, the last kick counted twice). */
function aims(s: State, shooter: number, recent: boolean): number[] {
  const counts = [1, 1, 1];
  const mine = s.kicks.filter((k) => k.shooter === shooter);
  mine.forEach((k, i) => {
    const c = columnOf(k.spot);
    counts[c] = (counts[c] ?? 0) + (recent && i === mine.length - 1 ? 2 : 1);
  });
  return counts;
}

function weighted(rng: Rng, weights: readonly number[]): number {
  let r = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i] ?? 0;
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

/** The chance a shot at `spot` scores against a keeper who dives by `p`. */
function scoreChance(spot: number, p: readonly number[]): number {
  const total = p.reduce((a, b) => a + b, 0);
  const col = columnOf(spot);
  const reach = !(isHigh(spot) && col !== 1);
  const saved = reach ? (p[col] ?? 0) / total : 0;
  return (1 - overChance(spot)) * (1 - saved);
}

const easy: Bot<State, Action> = {
  choose(s, seat, { rng }) {
    return seat === shooterOf(s)
      ? { shoot: rng.int(0, SPOTS - 1) }
      : { dive: rng.int(0, DIVES - 1) };
  },
};

const reader = (hard: boolean): Bot<State, Action> => ({
  choose(s, seat, { rng }) {
    const mix = hard ? 0.25 : 0.4;
    if (seat === shooterOf(s)) {
      if (rng.next() < mix) return { shoot: rng.int(0, SPOTS - 1) };
      const p = dives(s, keeperOf(s));
      if (!hard) {
        // Low, away from the keeper's favourite column.
        const fav = p.indexOf(Math.max(...p));
        const cols = [0, 1, 2].filter((c) => c !== fav);
        return { shoot: cols[rng.int(0, cols.length - 1)] ?? 0 };
      }
      const chances = Array.from({ length: SPOTS }, (_, spot) => scoreChance(spot, p) ** 3);
      return { shoot: weighted(rng, chances) };
    }
    if (rng.next() < mix) return { dive: rng.int(0, DIVES - 1) };
    const a = aims(s, shooterOf(s), hard);
    return {
      dive: hard
        ? weighted(
            rng,
            a.map((x) => x * x),
          )
        : a.indexOf(Math.max(...a)),
    };
  },
});

export const bots: GameBots<State, Action> = { easy, medium: reader(false), hard: reader(true) };
