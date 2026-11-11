// Split or Steal bots (SPEC §9.5). They see every finished round (who
// split, who stole), never a choice still hidden. They don't talk.
// - Easy: a coin toss.
// - Medium: splits, unless its partner has stolen before (from anyone),
//   then mostly pays them back in kind.
// - Hard: splits with partners who split and steals from stealers, by how
//   often they've stolen, and is more tempted in the last round, or when it
//   needs the points to catch up.
import type { Bot, GameBots } from "@kefche/game-sdk";

import { pairOf, type Action, type Choice, type State } from "../engine";

/** How often `seat` has stolen, of the times they've chosen. */
function stealRate(s: State, seat: number): number | null {
  let chosen = 0;
  let stole = 0;
  for (const round of s.history) {
    for (const p of round) {
      const side = p.a === seat ? 0 : p.b === seat ? 1 : null;
      if (side === null) continue;
      chosen++;
      if (p.choices[side] === "steal") stole++;
    }
  }
  return chosen === 0 ? null : stole / chosen;
}

const choose = (choice: Choice): Action => ({ choose: choice });

const partnerOf = (s: State, seat: number): number | null => {
  const mine = pairOf(s, seat);
  return mine ? (mine.side === 0 ? mine.pair.b : mine.pair.a) : null;
};

const easy: Bot<State, Action> = {
  choose: (_s, _seat, { rng }) => choose(rng.next() < 0.5 ? "split" : "steal"),
};

const medium: Bot<State, Action> = {
  choose(s, seat, { rng }) {
    const partner = partnerOf(s, seat);
    const rate = partner === null ? null : stealRate(s, partner);
    if (rate !== null && rate > 0) return choose(rng.next() < 0.75 ? "steal" : "split");
    return choose(rng.next() < 0.85 ? "split" : "steal");
  },
};

const hard: Bot<State, Action> = {
  choose(s, seat, { rng }) {
    const partner = partnerOf(s, seat);
    const rate = partner === null ? null : stealRate(s, partner);
    let steal = rate === null ? 0.2 : 0.1 + rate * 0.8;
    if (s.round === s.config.rounds - 1) steal += 0.25;
    const behind = Math.max(...s.scores) - (s.scores[seat] ?? 0);
    const pot = pairOf(s, seat)?.pair.pot ?? 0;
    if (behind >= pot / 2 && behind > 0) steal += 0.2;
    return choose(rng.next() < Math.min(0.95, steal) ? "steal" : "split");
  },
};

export const bots: GameBots<State, Action> = { easy, medium, hard };
