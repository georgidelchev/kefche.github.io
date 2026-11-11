// Conquest bots (SPEC §9.5). The whole map is public; only the dice to come
// are unknown.
// - Easy: places on a random border, attacks when it has more armies than
//   the defender (and now and then stops early), moves everything in, and
//   never fortifies.
// - Medium: picks the region it's closest to holding, reinforces its
//   strongest border there, attacks with at least two more armies than the
//   defender (regions it's after first), moves everything into a taken
//   territory unless that leaves a border bare, and fortifies a border
//   from the interior.
// - Hard: also attacks with a smaller edge when the odds are good, breaks
//   other players' whole regions, and fortifies the border facing the
//   strongest neighbour.
import type { Bot, GameBots, Rng } from "@kefche/game-sdk";

import {
  BONUS,
  NEIGHBOURS,
  PER_REGION,
  REGIONS,
  engine,
  regionOf,
  territoriesOf,
  type Action,
  type State,
} from "../engine";

type Level = "easy" | "medium" | "hard";

const armies = (s: State, t: number) => s.armies[t] ?? 0;
const enemies = (s: State, seat: number, t: number) =>
  (NEIGHBOURS[t] ?? []).filter((n) => s.owner[n] !== seat);
const border = (s: State, seat: number, t: number) => enemies(s, seat, t).length > 0;
/** Strongest enemy army next door. */
const threat = (s: State, seat: number, t: number) =>
  Math.max(0, ...enemies(s, seat, t).map((n) => armies(s, n)));

/** How much `seat` wants each region: share held, by its bonus and size. */
function regionWant(s: State, seat: number): number[] {
  return Array.from({ length: REGIONS }, (_, r) => {
    let held = 0;
    for (let k = 0; k < PER_REGION; k++) if (s.owner[r * PER_REGION + k] === seat) held++;
    return (held / PER_REGION) * 2 + (BONUS[r] ?? 0) * 0.15 + (held === PER_REGION ? 0.5 : 0);
  });
}

/** Chance of taking a territory by attacking until one side runs out (a rough table). */
function odds(attack: number, defend: number): number {
  const ratio = (attack - 1) / Math.max(1, defend);
  return Math.max(0, Math.min(1, 0.5 + (ratio - 1) * 0.35));
}

function reinforce(s: State, seat: number, rng: Rng, level: Level, actions: Action[]): Action {
  const own = territoriesOf(s, seat).filter((t) => border(s, seat, t));
  const places = own.length > 0 ? own : territoriesOf(s, seat);
  let target = rng.pick(places);
  if (level !== "easy") {
    const want = regionWant(s, seat);
    let best = -Infinity;
    for (const t of places) {
      const score = (want[regionOf(t)] ?? 0) * 3 + armies(s, t) * 0.2 + rng.next() * 0.01;
      if (score > best) {
        best = score;
        target = t;
      }
    }
  }
  const all = actions.filter((a) => "place" in a && a.place === target);
  // Put everything there at once.
  return all.reduce(
    (x, a) => ("n" in a && "n" in x && a.n > x.n ? a : x),
    all[0] ?? actions[0] ?? { end: true },
  );
}

function attack(s: State, seat: number, rng: Rng, level: Level, actions: Action[]): Action {
  const want = regionWant(s, seat);
  let best: Action = { end: true };
  let bestScore = level === "easy" ? 0 : 0.35;
  for (const a of actions) {
    if (!("attack" in a)) continue;
    const mine = armies(s, a.attack);
    const theirs = armies(s, a.to);
    let score: number;
    if (level === "easy") score = mine > theirs ? 0.5 + rng.next() * 0.5 : -1;
    else {
      if (mine < theirs + (level === "medium" ? 2 : 1)) continue;
      score = (level === "hard" ? odds(mine, theirs) : 0.6) + (want[regionOf(a.to)] ?? 0) * 0.2;
      if (level === "hard") {
        // Breaking someone else's whole region is worth a lot.
        const r = regionOf(a.to);
        const defender = s.owner[a.to];
        let held = 0;
        for (let k = 0; k < PER_REGION; k++) if (s.owner[r * PER_REGION + k] === defender) held++;
        if (held === PER_REGION) score += 0.4;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  if (level === "easy" && "attack" in best && rng.next() < 0.15) return { end: true };
  return best;
}

function occupy(s: State, seat: number, level: Level, actions: Action[]): Action {
  const sizes = actions.flatMap((a) => ("occupy" in a ? [a.occupy] : []));
  const most = Math.max(...sizes);
  const least = Math.min(...sizes);
  const o = s.occupy;
  if (level === "easy" || !o) return { occupy: most };
  // Leave the old territory guarded if it still faces enemies.
  const backExposed = border(s, seat, o.from);
  const frontExposed = border(s, seat, o.to);
  if (backExposed && !frontExposed) return { occupy: least };
  return { occupy: most };
}

function fortify(s: State, seat: number, level: Level, actions: Action[]): Action {
  if (level === "easy") return { end: true };
  let best: Action = { end: true };
  let bestScore = 0;
  for (const a of actions) {
    if (!("fortify" in a)) continue;
    // From the interior to a border, as much as can go.
    if (border(s, seat, a.fortify)) continue;
    if (!border(s, seat, a.to)) continue;
    const score = a.n + (level === "hard" ? threat(s, seat, a.to) * 0.5 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return best;
}

const bot = (level: Level): Bot<State, Action> => ({
  choose(s, seat, { rng }) {
    const actions = engine.legalActions(s, seat);
    switch (s.phase) {
      case "reinforce":
        return reinforce(s, seat, rng, level, actions);
      case "attack":
        return attack(s, seat, rng, level, actions);
      case "occupy":
        return occupy(s, seat, level, actions);
      case "fortify":
        return fortify(s, seat, level, actions);
    }
  },
});

export const bots: GameBots<State, Action> = {
  easy: bot("easy"),
  medium: bot("medium"),
  hard: bot("hard"),
};
