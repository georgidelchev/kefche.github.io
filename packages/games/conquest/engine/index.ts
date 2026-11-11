// Conquest (SPEC §20.6 #83): an original game of territory on kefche's own
// map (`map.ts`), for 2–6 players.
// - The territories are dealt out and each player's armies spread over
//   theirs at random.
// - A turn has three parts. Reinforce: place max(3, territories / 3)
//   armies, plus each whole region's bonus, plus 2 for supply when you took
//   a territory last turn. Attack: from a territory with two or more
//   armies into a neighbouring enemy one; the attacker rolls up to three
//   dice and the defender up to two, the highest dice are compared in pairs
//   and each loss removes an army (ties go to the defender). Take a
//   territory and you move armies in. Fortify: once, move armies between
//   two neighbouring territories of yours.
// - A player with no territories is out. The goal is most of the map (26
//   territories for two players, 22 for three, 20 for more) or all of it; after 40 rounds, whoever holds the most
//   territories wins.
// Amounts are chosen from a few (one, half, all) so every move is a short
// list. The dice come from the state's Rng, which views never show: online
// the table rolls them (ADR-0047).
import { Rng, sameAction, type GameResult, type RngState, type TurnEngine } from "@kefche/game-sdk";

import { BONUS, NEIGHBOURS, PER_REGION, REGIONS, TERRITORIES } from "./map";

export * from "./map";

export interface Config {
  goal: "most" | "all";
}

export function configFrom(raw: unknown): Config {
  return { goal: (raw as { goal?: unknown } | undefined)?.goal === "all" ? "all" : "most" };
}

/** The "most of the map" goal: more with fewer players, who start with more. */
export const MOST: Record<number, number> = { 2: 26, 3: 22, 4: 20, 5: 20, 6: 20 };
export const goalOf = (s: { players: number; config: Config }) =>
  s.config.goal === "all" ? TERRITORIES : (MOST[s.players] ?? 20);
export const ROUNDS = 40;
const START: Record<number, number> = { 2: 30, 3: 21, 4: 16, 5: 13, 6: 11 };

export interface Roll {
  seat: number;
  defender: number;
  from: number;
  to: number;
  attack: number[];
  defend: number[];
  /** Armies lost by the attacker and the defender. */
  lost: [number, number];
  taken: boolean;
}

export interface State {
  players: number;
  config: Config;
  owner: number[];
  armies: number[];
  turn: number;
  phase: "reinforce" | "attack" | "occupy" | "fortify";
  /** Armies still to place this turn. */
  pending: number;
  /** A territory just taken: armies move in from `from`, at least `min`. */
  occupy: { from: number; to: number; min: number } | null;
  /** Took a territory this turn (supply next turn). */
  took: boolean;
  supply: boolean[];
  out: boolean[];
  round: number;
  last: Roll | null;
  winner: number | null;
  /** Shared wins when the rounds run out level. */
  outcome: number[] | null;
  moves: number;
  rng: RngState;
}

export type Action =
  | { place: number; n: number }
  | { attack: number; to: number }
  | { occupy: number }
  | { fortify: number; to: number; n: number }
  | { end: true };

export const territoriesOf = (s: State, seat: number) =>
  s.owner.flatMap((o, i) => (o === seat ? [i] : []));

export function regionsOf(s: State, seat: number): number[] {
  return Array.from({ length: REGIONS }, (_, r) => r).filter((r) =>
    Array.from({ length: PER_REGION }, (_, k) => r * PER_REGION + k).every(
      (i) => s.owner[i] === seat,
    ),
  );
}

export function reinforcements(s: State, seat: number): number {
  const own = territoriesOf(s, seat).length;
  const bonus = regionsOf(s, seat).reduce((n, r) => n + (BONUS[r] ?? 0), 0);
  return Math.max(3, Math.floor(own / 3)) + bonus + (s.supply[seat] ? 2 : 0);
}

/** A few amounts between `min` and `max`: the least, about half, and all. */
export function amounts(min: number, max: number): number[] {
  if (max < min) return [];
  return [...new Set([min, Math.max(min, Math.ceil(max / 2)), max])].sort((a, b) => a - b);
}

function initialState(config: Config, seats: number, seed: string): State {
  const rng = Rng.fromSeed(seed);
  const order = rng.shuffle(Array.from({ length: TERRITORIES }, (_, i) => i));
  const owner = Array.from({ length: TERRITORIES }, () => 0);
  order.forEach((territory, k) => {
    owner[territory] = k % seats;
  });
  const armies = Array.from({ length: TERRITORIES }, () => 1);
  for (let seat = 0; seat < seats; seat++) {
    const own = owner.flatMap((o, i) => (o === seat ? [i] : []));
    for (let extra = (START[seats] ?? 11) - own.length; extra > 0; extra--) {
      const at = rng.pick(own);
      armies[at] = (armies[at] ?? 0) + 1;
    }
  }
  const s: State = {
    players: seats,
    config,
    owner,
    armies,
    turn: 0,
    phase: "reinforce",
    pending: 0,
    occupy: null,
    took: false,
    supply: Array.from({ length: seats }, () => false),
    out: Array.from({ length: seats }, () => false),
    round: 1,
    last: null,
    winner: null,
    outcome: null,
    moves: 0,
    rng: rng.state,
  };
  return { ...s, pending: reinforcements(s, 0) };
}

function legalActions(s: State, seat: number): Action[] {
  if (s.outcome !== null || seat !== s.turn) return [];
  const own = territoriesOf(s, seat);
  const armies = (i: number) => s.armies[i] ?? 0;
  switch (s.phase) {
    case "reinforce":
      return own.flatMap((place) => amounts(1, s.pending).map((n) => ({ place, n })));
    case "attack": {
      const out: Action[] = [];
      for (const from of own) {
        if (armies(from) < 2) continue;
        for (const to of NEIGHBOURS[from] ?? [])
          if (s.owner[to] !== seat) out.push({ attack: from, to });
      }
      out.push({ end: true });
      return out;
    }
    case "occupy": {
      const o = s.occupy;
      return o ? amounts(o.min, armies(o.from) - 1).map((occupy) => ({ occupy })) : [];
    }
    case "fortify": {
      const out: Action[] = [];
      for (const from of own) {
        if (armies(from) < 2) continue;
        for (const to of NEIGHBOURS[from] ?? []) {
          if (s.owner[to] === seat)
            for (const n of amounts(1, armies(from) - 1)) out.push({ fortify: from, to, n });
        }
      }
      out.push({ end: true });
      return out;
    }
  }
}

const descending = (a: number, b: number) => b - a;

/** The player after `seat` still in, and whether a round has passed. */
function nextPlayer(s: State, seat: number): { seat: number; wrapped: boolean } {
  for (let k = 1; k <= s.players; k++) {
    const next = (seat + k) % s.players;
    if (!s.out[next]) return { seat: next, wrapped: next <= seat };
  }
  return { seat, wrapped: true };
}

function finish(s: State): State {
  const counts = Array.from({ length: s.players }, (_, p) => territoriesOf(s, p).length);
  const alive = counts.flatMap((c, p) => (c > 0 ? [p] : []));
  const goal = goalOf(s);
  const leader = counts.findIndex((c) => c >= goal);
  if (alive.length === 1 || leader >= 0) {
    const winner = alive.length === 1 ? (alive[0] ?? 0) : leader;
    return { ...s, winner, outcome: counts.map((_, p) => (p === winner ? 1 : 0)) };
  }
  return s;
}

function endTurn(s: State): State {
  const supply = s.supply.map((v, p) => (p === s.turn ? s.took : v));
  const { seat, wrapped } = nextPlayer(s, s.turn);
  const round = wrapped ? s.round + 1 : s.round;
  if (round > ROUNDS) {
    const counts = Array.from({ length: s.players }, (_, p) => territoriesOf(s, p).length);
    const best = Math.max(...counts);
    const top = counts.filter((c) => c === best).length;
    return {
      ...s,
      supply,
      phase: "fortify",
      outcome: counts.map((c) => (c === best ? (top === 1 ? 1 : 0.5) : 0)),
      winner: top === 1 ? counts.indexOf(best) : null,
    };
  }
  const next: State = {
    ...s,
    supply,
    turn: seat,
    round,
    phase: "reinforce",
    took: false,
    occupy: null,
  };
  return { ...next, pending: reinforcements(next, seat) };
}

function applyAction(s: State, seat: number, action: Action): State {
  if (s.outcome !== null || seat !== s.turn) return s;
  if (!legalActions(s, seat).some((a) => sameAction(a, action))) return s;
  const moved = { ...s, moves: s.moves + 1 };
  const armies = [...s.armies];
  if ("place" in action) {
    armies[action.place] = (armies[action.place] ?? 0) + action.n;
    const pending = s.pending - action.n;
    return { ...moved, armies, pending, phase: pending > 0 ? "reinforce" : "attack" };
  }
  if ("attack" in action) {
    const { attack: from, to } = action;
    const rng = new Rng(s.rng);
    const a = Math.min(3, (armies[from] ?? 0) - 1);
    const d = Math.min(2, armies[to] ?? 0);
    const attack = Array.from({ length: a }, () => rng.int(1, 6)).sort(descending);
    const defend = Array.from({ length: d }, () => rng.int(1, 6)).sort(descending);
    const lost: [number, number] = [0, 0];
    for (let k = 0; k < Math.min(a, d); k++) {
      if ((attack[k] ?? 0) > (defend[k] ?? 0)) lost[1]++;
      else lost[0]++;
    }
    armies[from] = (armies[from] ?? 0) - lost[0];
    armies[to] = (armies[to] ?? 0) - lost[1];
    const taken = (armies[to] ?? 0) === 0;
    const defender = s.owner[to] ?? 0;
    const owner = [...s.owner];
    const roll: Roll = { seat, defender, from, to, attack, defend, lost, taken };
    if (!taken) return { ...moved, armies, last: roll, rng: rng.state };
    owner[to] = seat;
    const out = s.out.map((o, p) => o || (p === defender && !owner.includes(defender)));
    const min = Math.min(a - lost[0], (armies[from] ?? 1) - 1);
    const next: State = {
      ...moved,
      owner,
      armies,
      out,
      took: true,
      last: roll,
      rng: rng.state,
      phase: "occupy",
      occupy: { from, to, min: Math.max(1, min) },
    };
    return finish(next);
  }
  if ("occupy" in action) {
    const o = s.occupy;
    if (!o) return s;
    armies[o.from] = (armies[o.from] ?? 0) - action.occupy;
    armies[o.to] = (armies[o.to] ?? 0) + action.occupy;
    return { ...moved, armies, occupy: null, phase: "attack" };
  }
  if ("fortify" in action) {
    armies[action.fortify] = (armies[action.fortify] ?? 0) - action.n;
    armies[action.to] = (armies[action.to] ?? 0) + action.n;
    return endTurn({ ...moved, armies });
  }
  // End: attacks give way to fortifying, and fortifying to the next player.
  return s.phase === "attack" ? { ...moved, phase: "fortify" } : endTurn(moved);
}

function currentSeats(s: State): number[] {
  return s.outcome === null ? [s.turn] : [];
}

function result(s: State): GameResult | null {
  return s.outcome === null ? null : { completed: true, outcome: s.outcome };
}

/** Everything is public but the Rng: the next roll is the table's secret. */
function view(s: State): State {
  return { ...s, rng: [0, 0, 0, 0] };
}

export const engine: TurnEngine<State, Action, Config> = {
  initialState,
  legalActions,
  applyAction,
  currentSeats,
  result,
  view,
};
