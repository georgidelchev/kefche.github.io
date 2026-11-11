// Mafia bots (SPEC §9.5). They never talk; they act and vote from what
// they're allowed to know (a view): their own role, the Mafia each other,
// the Detective what they've checked, and everyone the narrator's story
// (who fell, their roles, and who voted for whom).
// - Easy: chooses and votes at random (the Mafia never against themselves).
// - Medium: the Detective votes out Mafia they've found, and never their
//   cleared players; the Doctor protects themselves now and then; others
//   vote for whoever voted to eliminate players who turned out innocent.
// - Hard: the Mafia eliminate the most trusted players (those who never
//   voted against an innocent), and the Doctor guards them.
import type { Bot, GameBots, Rng } from "@kefche/game-sdk";

import { HIDDEN, NOBODY, engine, type Action, type State } from "../engine";

type Level = "easy" | "medium" | "hard";

const alive = (s: State) => s.alive.flatMap((a, seat) => (a ? [seat] : []));

/** How suspicious each seat looks from the story: votes against innocents. */
function suspicion(s: State): number[] {
  const score = Array.from({ length: s.players }, () => 0);
  for (const e of s.events) {
    if (e.kind !== "executed") continue;
    const innocent = e.role !== "mafia";
    e.votes.forEach((v, voter) => {
      if (v === e.seat) score[voter] = (score[voter] ?? 0) + (innocent ? 1 : -1);
    });
  }
  return score;
}

function night(s: State, seat: number, rng: Rng, level: Level, actions: Action[]): Action {
  const role = s.roles[seat];
  const targets = actions.flatMap((a) => ("target" in a ? [a.target] : []));
  if (targets.length === 0) return actions[0] ?? { sleep: true };
  if (level === "hard" && (role === "mafia" || role === "doctor")) {
    // The most trusted (least suspicious) players are the Mafia's best
    // targets, so the Doctor guards them too.
    const score = suspicion(s);
    const pool = targets.filter((t) => t !== seat);
    const least = Math.min(...pool.map((t) => score[t] ?? 0));
    const trusted = pool.filter((t) => (score[t] ?? 0) === least);
    if (trusted.length > 0 && rng.next() < 0.7) return { target: rng.pick(trusted) };
  }
  if (role === "doctor" && level !== "easy" && rng.next() < 0.35) return { target: seat };
  if (role === "detective" && level !== "easy") {
    const checked = new Set(s.checks.map((c) => c.seat));
    const fresh = targets.filter((t) => !checked.has(t));
    if (fresh.length > 0) return { target: rng.pick(fresh) };
  }
  if (role === "mafia" && level !== "easy") {
    // Follow a partner's choice, so the Mafia agree.
    const partner = alive(s).find(
      (x) => x !== seat && s.roles[x] === "mafia" && typeof s.night[x] === "number",
    );
    const pick = partner === undefined ? undefined : s.night[partner];
    if (typeof pick === "number" && targets.includes(pick)) return { target: pick };
  }
  return { target: rng.pick(targets) };
}

function vote(s: State, seat: number, rng: Rng, level: Level, actions: Action[]): Action {
  const choices = actions.flatMap((a) => ("vote" in a && a.vote !== NOBODY ? [a.vote] : []));
  if (choices.length === 0) return { vote: NOBODY };
  const role = s.roles[seat];
  const known = (x: number) => s.roles[x] !== HIDDEN;
  if (level === "easy")
    return {
      vote: rng.pick(role === "mafia" ? choices.filter((x) => s.roles[x] !== "mafia") : choices),
    };
  if (role === "detective") {
    const found = s.checks.find((c) => c.mafia && s.alive[c.seat]);
    if (found) return { vote: found.seat };
  }
  const cleared = new Set(
    role === "detective" ? s.checks.filter((c) => !c.mafia).map((c) => c.seat) : [],
  );
  const pool = choices.filter(
    (x) => !cleared.has(x) && !(role === "mafia" && known(x) && s.roles[x] === "mafia"),
  );
  if (pool.length === 0) return { vote: NOBODY };
  const score = suspicion(s);
  const best = Math.max(...pool.map((x) => score[x] ?? 0));
  const top = pool.filter((x) => (score[x] ?? 0) === best);
  return { vote: rng.pick(top) };
}

const bot = (level: Level): Bot<State, Action> => ({
  choose(s, seat, { rng }) {
    const actions = engine.legalActions(s, seat);
    if (s.phase === "night") return night(s, seat, rng, level, actions);
    if (s.phase === "talk") return { ready: true };
    return vote(s, seat, rng, level, actions);
  },
});

export const bots: GameBots<State, Action> = {
  easy: bot("easy"),
  medium: bot("medium"),
  hard: bot("hard"),
};
