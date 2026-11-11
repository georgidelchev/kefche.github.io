// Rock Paper Scissors Tournament bots (SPEC §9.5). They see every throw
// shown so far (in every match), never a throw still hidden.
// - Easy: throws at random.
// - Medium and hard learn what the opponent tends to throw after each
//   throw of theirs (and after winning or losing), and counter it; medium
//   throws at random more than half the time, hard a quarter of the time,
//   enough not to be read itself.
import type { Bot, GameBots, Rng } from "@kefche/game-sdk";

import { THROWS, matchOf, type Action, type State, type Throw } from "../engine";

const counter = (t: Throw): Throw => ((t + 1) % 3) as Throw;

/** Every throw `seat` has shown, in order, with how each one went for them. */
function history(s: State, seat: number): { mine: Throw; theirs: Throw }[] {
  const out: { mine: Throw; theirs: Throw }[] = [];
  for (const round of s.rounds) {
    for (const m of round) {
      const side = m.a === seat ? 0 : m.b === seat ? 1 : null;
      if (side === null) continue;
      for (const pair of m.throws) out.push({ mine: pair[side], theirs: pair[side === 0 ? 1 : 0] });
    }
  }
  return out;
}

function mostFrequent(throws: readonly Throw[]): Throw | null {
  if (throws.length < 2) return null;
  const counts = [0, 0, 0];
  for (const t of throws) counts[t] = (counts[t] ?? 0) + 1;
  const best = Math.max(...counts);
  return counts.indexOf(best) as Throw;
}

function predict(past: readonly { mine: Throw; theirs: Throw }[]): Throw | null {
  const last = past.at(-1);
  if (!last || past.length < 3) return mostFrequent(past.map((p) => p.mine));
  // What they threw next after the same throw (and the same result) before.
  const outcome = (p: { mine: Throw; theirs: Throw }) => (p.mine - p.theirs + 3) % 3; // 0 draw, 1 they won, 2 they lost
  const next = [0, 0, 0];
  for (let i = 0; i + 1 < past.length; i++) {
    const p = past[i];
    const q = past[i + 1];
    if (!p || !q) continue;
    const weight = (p.mine === last.mine ? 2 : 0) + (outcome(p) === outcome(last) ? 1 : 0);
    next[q.mine] = (next[q.mine] ?? 0) + weight;
  }
  const best = Math.max(...next);
  return best > 0 ? (next.indexOf(best) as Throw) : mostFrequent(past.map((p) => p.mine));
}

const random = (rng: Rng): Action => ({ throw: rng.pick(THROWS) });

const easy: Bot<State, Action> = { choose: (_s, _seat, { rng }) => random(rng) };

const reader = (hard: boolean): Bot<State, Action> => ({
  choose(s, seat, { rng }) {
    const mine = matchOf(s, seat);
    const opponent = mine ? (mine.side === 0 ? mine.match.b : mine.match.a) : null;
    if (opponent === null) return random(rng);
    const past = history(s, opponent);
    const guess = predict(past);
    if (guess === null || rng.next() < (hard ? 0.25 : 0.6)) return random(rng);
    return { throw: counter(guess) };
  },
});

export const bots: GameBots<State, Action> = { easy, medium: reader(false), hard: reader(true) };
