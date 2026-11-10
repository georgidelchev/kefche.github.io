// Chinese Checkers bots (SPEC §9.5): distance heuristics. Each piece is
// worth its distance to the far tip of its goal; a move's gain is how much
// closer it brings its piece. Easy moves forward at random most of the time;
// medium takes the biggest gain; hard adds the best gain of its own next
// move and favours its stragglers, so no piece is left behind at home.
import type { Bot, GameBots } from "@kefche/game-sdk";

import {
  ARMS,
  goalOf,
  HOLES,
  homeCount,
  movesFor,
  engine,
  type Action,
  type State,
} from "../engine";

/** The goal's tip: the hole farthest out along its axis. */
function tipOf(arm: number): { x: number; y: number; z: number } {
  const [axis, sign] = ARMS[arm] ?? [0, 1];
  const c = [0, 0, 0];
  c[axis] = 8 * sign;
  // The other two coordinates share the rest: -4 each.
  for (let i = 0; i < 3; i++) if (i !== axis) c[i] = -4 * sign;
  return { x: c[0] ?? 0, y: c[1] ?? 0, z: c[2] ?? 0 };
}

const distance = (a: number, tip: { x: number; y: number; z: number }) => {
  const h = HOLES[a];
  if (!h) return 0;
  return Math.max(Math.abs(h.x - tip.x), Math.abs(h.y - tip.y), Math.abs(h.z - tip.z));
};

function scored(state: State, seat: number): { action: Action; gain: number; from: number }[] {
  const tip = tipOf(goalOf(state.seats, seat));
  return movesFor(state, seat).map((action) => ({
    action,
    gain: distance(action.from, tip) - distance(action.to, tip),
    from: distance(action.from, tip),
  }));
}

const bot = (level: "easy" | "medium" | "hard"): Bot<State, Action> => ({
  choose(state, seat, { rng, deadline, now }) {
    const list = scored(state, seat);
    // A move that fills the goal wins at once.
    const win = list.find(({ action }) => engine.applyAction(state, seat, action).winner === seat);
    if (win) return win.action;
    if (level === "easy") {
      const forward = list.filter((m) => m.gain > 0);
      return rng.pick(forward.length > 0 && rng.next() < 0.7 ? forward : list).action;
    }
    if (level === "medium") {
      const best = Math.max(...list.map((m) => m.gain));
      return rng.pick(list.filter((m) => m.gain === best)).action;
    }
    // Hard: gain, plus the best follow-up, plus a nudge for stragglers.
    const ranked = list
      .toSorted((a, b) => b.gain + 0.15 * b.from - (a.gain + 0.15 * a.from))
      .slice(0, 12);
    let best = ranked[0] ?? list[0];
    let bestValue = -Infinity;
    for (const m of ranked) {
      if (now() > deadline) break;
      const after = engine.applyAction(state, seat, m.action);
      const again = { ...after, turn: seat };
      const follow = Math.max(0, ...scored(again, seat).map((n) => n.gain));
      const value =
        m.gain +
        0.5 * follow +
        0.15 * m.from +
        0.5 * (homeCount(after, seat) - homeCount(state, seat));
      if (value > bestValue) {
        bestValue = value;
        best = m;
      }
    }
    return (best ?? rng.pick(list)).action;
  },
});

export const bots: GameBots<State, Action> = {
  easy: bot("easy"),
  medium: bot("medium"),
  hard: bot("hard"),
};
