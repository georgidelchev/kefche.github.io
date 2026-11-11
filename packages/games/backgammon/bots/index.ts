// Backgammon bots (SPEC §9.5). Every bot sees the whole board and the dice;
// only the next roll is unknown.
// - Easy: any legal move.
// - Medium: tries every full play of the dice and keeps the position that
//   scores best: fewer pips to go, made points (above all at home), hits,
//   and few blots left alone.
// - Hard: also counts the direct shots at each blot, values a prime, and
//   uses the cube by the race: it doubles a clear lead and drops a hopeless
//   one.
import type { Bot, GameBots } from "@kefche/game-sdk";

import {
  BAR,
  engine,
  legalSteps,
  other,
  pips,
  play,
  type Action,
  type State,
  type Step,
} from "../engine";

type Board = Pick<State, "points" | "bar" | "off">;

/** Every full play of the dice: the first step and the board it ends on. */
function plays(s: State, seat: number, budget: { left: number }): { first: Step; board: Board }[] {
  const out: { first: Step; board: Board }[] = [];
  const seen = new Set<string>();
  const walk = (b: Board, dice: number[], first: Step | null) => {
    if (budget.left-- <= 0) return;
    const steps = legalSteps({ ...s, ...b, dice }, seat);
    if (steps.length === 0) {
      const key = `${b.points.join()}|${b.bar.join()}|${b.off.join()}`;
      if (first && !seen.has(key)) {
        seen.add(key);
        out.push({ first, board: b });
      }
      return;
    }
    for (const step of steps) {
      const rest = [...dice];
      rest.splice(rest.indexOf(step.die), 1);
      walk(play(b, seat, step), rest, first ?? step);
    }
  };
  walk(s, [...s.dice], null);
  return out;
}

const mine = (seat: number, n: number) => (seat === 0 ? n > 0 : n < 0);
const size = (n: number) => Math.abs(n);

function evaluate(b: Board, seat: number, hard: boolean): number {
  const them = other(seat);
  let score = (pips(b, them) - pips(b, seat)) * 1;
  score += b.off[seat as 0 | 1] * 3;
  score += b.bar[them] * 12;
  const home = seat === 0 ? [0, 1, 2, 3, 4, 5] : [18, 19, 20, 21, 22, 23];
  let run = 0;
  b.points.forEach((n, i) => {
    if (!mine(seat, n)) {
      run = 0;
      return;
    }
    if (size(n) >= 2) {
      score += home.includes(i) ? 6 : 3;
      run++;
      if (hard && run >= 3) score += run * 2;
    } else {
      run = 0;
      // A blot: worse the more of theirs can hit it from 1 to 6 pips.
      let shots = 1;
      if (hard) {
        shots = 0;
        for (let d = 1; d <= 6; d++) {
          const from = seat === 0 ? i + d : i - d;
          if (from >= 0 && from <= 23 && mine(them, b.points[from] ?? 0)) shots++;
        }
        if (b.bar[them] > 0) shots++;
      }
      score -= (seat === 0 ? 24 - i : i + 1) * 0.15 * (hard ? shots : 1) + 4;
    }
  });
  return score;
}

const thinker = (hard: boolean): Bot<State, Action> => ({
  choose(s, seat, { now, deadline }) {
    const actions = engine.legalActions(s, seat);
    if (s.phase === "roll" || s.phase === "respond") {
      const lead = pips(s, other(seat)) - pips(s, seat);
      const mineP = Math.max(1, pips(s, seat));
      if (s.phase === "roll")
        return hard &&
          actions.some((a) => "double" in a) &&
          lead > 0.12 * mineP &&
          lead < 0.35 * mineP
          ? { double: true }
          : { roll: true };
      return lead < -0.3 * mineP ? { drop: true } : { take: true };
    }
    const budget = { left: now() < deadline ? 4000 : 200 };
    const options = plays(s, seat, budget);
    let best = options[0];
    let bestScore = -Infinity;
    for (const o of options) {
      const v = evaluate(o.board, seat, hard);
      if (v > bestScore) {
        bestScore = v;
        best = o;
      }
    }
    if (best) return { move: best.first };
    const first = actions[0];
    return first ?? { move: { from: BAR, die: 1 } };
  },
});

const easy: Bot<State, Action> = {
  choose(s, seat, { rng }) {
    const actions = engine.legalActions(s, seat);
    if (s.phase === "roll") return { roll: true };
    if (s.phase === "respond") return { take: true };
    return rng.pick(actions);
  },
};

export const bots: GameBots<State, Action> = { easy, medium: thinker(false), hard: thinker(true) };
