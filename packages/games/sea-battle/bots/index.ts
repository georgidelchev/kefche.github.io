// Sea Battle bots (SPEC §9.5). They see their own fleet and what their
// shots told them (a view), like a person.
// - Placing: easy and medium put each ship anywhere it fits; hard keeps its
//   ships apart, so one found ship doesn't give away the next.
// - Easy: fires at random, and only sometimes follows up a hit.
// - Medium: hunts on a checkerboard (every ship covers one of its squares)
//   and, after a hit, fires next to it, along the line once it has two.
// - Hard: counts, for every square, the ways the ships still afloat could
//   lie there given every miss, hit and sunk ship, and fires at the likeliest.
import type { Bot, GameBots, Rng } from "@kefche/game-sdk";

import {
  CELLS,
  FLEET,
  SIZE,
  cellsOf,
  engine,
  placements,
  type Action,
  type Ship,
  type State,
} from "../engine";

function place(s: State, seat: number, rng: Rng, apart: boolean): Action {
  const actions = engine.legalActions(s, seat);
  const first = actions[0];
  if (!first || "ready" in first) return first ?? { ready: true };
  const fleet = s.fleets[seat] ?? [];
  // Biggest ships first, so they always find room.
  const i = FLEET.findIndex((_, k) => !fleet[k]);
  let options = placements(fleet, i);
  if (apart) {
    const near = new Set<number>();
    fleet.forEach((ship, k) => {
      for (const c of (ship && cellsOf(ship, k)) ?? []) {
        const x = c % SIZE;
        const y = Math.floor(c / SIZE);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE) near.add(ny * SIZE + nx);
          }
      }
    });
    const clear = options.filter((p) => (cellsOf(p, i) ?? []).every((c) => !near.has(c)));
    if (clear.length > 0) options = clear;
  }
  return { place: rng.pick(options) };
}

interface Knowledge {
  shot: Set<number>;
  /** Hits on ships not yet sunk. */
  open: number[];
  /** Squares known to be empty or taken by a sunk ship. */
  blocked: Set<number>;
  /** Fleet indexes still afloat. */
  afloat: number[];
}

function know(s: State, seat: number): Knowledge {
  const shots = s.shots[seat] ?? [];
  const theirs = s.fleets[seat === 0 ? 1 : 0] ?? [];
  const sunkCells = new Set<number>();
  const sunk = new Set<number>();
  for (const shot of shots) {
    if (shot.sunk === null) continue;
    sunk.add(shot.sunk);
    const ship = theirs[shot.sunk];
    for (const c of (ship && cellsOf(ship, shot.sunk)) ?? []) sunkCells.add(c);
  }
  const blocked = new Set<number>(sunkCells);
  for (const shot of shots) if (!shot.hit) blocked.add(shot.cell);
  return {
    shot: new Set(shots.map((x) => x.cell)),
    open: shots.filter((x) => x.hit && !sunkCells.has(x.cell)).map((x) => x.cell),
    blocked,
    afloat: FLEET.flatMap((_, i) => (sunk.has(i) ? [] : [i])),
  };
}

const neighbours = (c: number): number[] => {
  const x = c % SIZE;
  const y = Math.floor(c / SIZE);
  const out: number[] = [];
  if (x > 0) out.push(c - 1);
  if (x < SIZE - 1) out.push(c + 1);
  if (y > 0) out.push(c - SIZE);
  if (y < SIZE - 1) out.push(c + SIZE);
  return out;
};

/** Squares next to open hits, along their line when two share one. */
function targets(k: Knowledge): number[] {
  const free = (c: number) => !k.shot.has(c);
  const open = new Set(k.open);
  for (const c of k.open) {
    for (const [step, ok] of [
      [1, (a: number, b: number) => Math.floor(a / SIZE) === Math.floor(b / SIZE)],
      [SIZE, () => true],
    ] as const) {
      if (!open.has(c + step) || !ok(c, c + step)) continue;
      // A line of hits: try its two ends.
      let lo = c;
      while (open.has(lo - step) && ok(lo, lo - step)) lo -= step;
      let hi = c;
      while (open.has(hi + step) && ok(hi, hi + step)) hi += step;
      const ends = [lo - step, hi + step].filter(
        (e) => e >= 0 && e < CELLS && ok(e === lo - step ? lo : hi, e) && free(e),
      );
      if (ends.length > 0) return ends;
    }
  }
  return k.open.flatMap(neighbours).filter(free);
}

/** For each square, how many ways the ships afloat could cover it. */
function density(k: Knowledge): number[] {
  const score = Array.from({ length: CELLS }, () => 0);
  const open = new Set(k.open);
  for (const i of k.afloat) {
    for (const horizontal of [true, false]) {
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const ship: Ship = { x, y, horizontal };
          const cells = cellsOf(ship, i);
          if (!cells || cells.some((c) => k.blocked.has(c))) continue;
          const covers = cells.filter((c) => open.has(c)).length;
          // A placement through open hits is far likelier than one in the blue.
          const weight = covers > 0 ? 50 * covers : 1;
          for (const c of cells) if (!k.shot.has(c)) score[c] = (score[c] ?? 0) + weight;
        }
      }
    }
  }
  return score;
}

function fire(s: State, seat: number, rng: Rng, level: "easy" | "medium" | "hard"): Action {
  const k = know(s, seat);
  const free = Array.from({ length: CELLS }, (_, c) => c).filter((c) => !k.shot.has(c));
  if (level === "hard") {
    const d = density(k);
    let best = -1;
    let picks: number[] = [];
    for (const c of free) {
      const v = d[c] ?? 0;
      if (v > best) {
        best = v;
        picks = [c];
      } else if (v === best) picks.push(c);
    }
    return { fire: rng.pick(picks.length > 0 ? picks : free) };
  }
  const near = targets(k);
  if (near.length > 0 && (level === "medium" || rng.next() < 0.5)) return { fire: rng.pick(near) };
  if (level === "medium") {
    const parity = free.filter((c) => (c % SIZE) % 2 === Math.floor(c / SIZE) % 2);
    if (parity.length > 0) return { fire: rng.pick(parity) };
  }
  return { fire: rng.pick(free) };
}

const bot = (level: "easy" | "medium" | "hard"): Bot<State, Action> => ({
  choose(s, seat, { rng }) {
    if (s.phase === "place") return place(s, seat, rng, level === "hard");
    return fire(s, seat, rng, level);
  },
});

export const bots: GameBots<State, Action> = {
  easy: bot("easy"),
  medium: bot("medium"),
  hard: bot("hard"),
};
