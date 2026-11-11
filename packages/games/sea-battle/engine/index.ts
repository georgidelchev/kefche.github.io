// Sea Battle (SPEC §20.1 #5): two players, a 10 × 10 grid each and a fleet
// of five ships (5, 4, 3, 3 and 2 squares).
// - Placing: both players place their ships at once, in secret, in a line
//   across or down, never overlapping (touching is allowed). A placed ship
//   may be moved or turned until its player is ready.
// - Firing: the first player fires at a square of the other's waters, and is
//   told miss, hit, or sunk (with the whole ship shown). Turns alternate;
//   with "shoot again" on, a hit fires again.
// - Sinking every ship wins.
// Placing a ship is one move each: an unplaced ship's every square is a
// legal action (so a clock running out still places one), and moving a
// placed ship is a side action, which random moves never choose. Views
// hide the other fleet but its sunk ships: online the table holds both
// fleets (ADR-0047).
import type { GameResult, TurnEngine } from "@kefche/game-sdk";

export interface Config {
  /** A hit fires again. */
  again: boolean;
}

export function configFrom(raw: unknown): Config {
  return { again: (raw as { again?: unknown } | undefined)?.again === true };
}

export const SIZE = 10;
export const FLEET = [5, 4, 3, 3, 2] as const;
export const CELLS = SIZE * SIZE;

export interface Ship {
  x: number;
  y: number;
  horizontal: boolean;
}

export interface Shot {
  cell: number;
  hit: boolean;
  /** The ship this shot sank, if it did. */
  sunk: number | null;
}

export interface State {
  config: Config;
  phase: "place" | "fire";
  /** Each seat's ships by fleet index (null: not placed, or hidden in a view). */
  fleets: (Ship | null)[][];
  ready: boolean[];
  /** The shots each seat has fired at the other. */
  shots: Shot[][];
  turn: number;
  /** The latest shot: who fired, and its index in their shots. */
  last: { seat: number; index: number } | null;
  winner: number | null;
  moves: number;
}

export interface Placement extends Ship {
  ship: number;
}

export type Action = { place: Placement } | { ready: true } | { fire: number };

export const other = (seat: number) => (seat === 0 ? 1 : 0);

/** The squares a ship of fleet index `i` covers, or null when it's off the grid. */
export function cellsOf(ship: Ship, i: number): number[] | null {
  const size = FLEET[i];
  if (size === undefined) return null;
  const { x, y, horizontal } = ship;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) return null;
  if (horizontal ? x + size > SIZE || y >= SIZE : y + size > SIZE || x >= SIZE) return null;
  return Array.from({ length: size }, (_, k) =>
    horizontal ? y * SIZE + x + k : (y + k) * SIZE + x,
  );
}

/** Squares taken by `fleet`, leaving out ship `skip`. */
function taken(fleet: readonly (Ship | null)[], skip: number): Set<number> {
  const out = new Set<number>();
  fleet.forEach((ship, i) => {
    if (ship && i !== skip) for (const c of cellsOf(ship, i) ?? []) out.add(c);
  });
  return out;
}

/** Can ship `i` go there, given the rest of the fleet? */
export function fits(fleet: readonly (Ship | null)[], i: number, ship: Ship): boolean {
  const cells = cellsOf(ship, i);
  if (!cells) return false;
  const used = taken(fleet, i);
  return cells.every((c) => !used.has(c));
}

/** Every place ship `i` could go. */
export function placements(fleet: readonly (Ship | null)[], i: number): Placement[] {
  const out: Placement[] = [];
  for (const horizontal of [true, false]) {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const ship = { x, y, horizontal };
        if (fits(fleet, i, ship)) out.push({ ship: i, ...ship });
      }
    }
  }
  return out;
}

/** Which of `seat`'s ships stands on `cell`, if any. */
export function shipAt(fleet: readonly (Ship | null)[], cell: number): number | null {
  for (let i = 0; i < fleet.length; i++) {
    const ship = fleet[i];
    if (ship && cellsOf(ship, i)?.includes(cell)) return i;
  }
  return null;
}

/** The ships of `seat`'s fleet the other player has sunk. */
export function sunkShips(s: State, seat: number): Set<number> {
  return new Set(
    (s.shots[other(seat)] ?? []).flatMap((shot) => (shot.sunk === null ? [] : [shot.sunk])),
  );
}

function initialState(config: Config): State {
  return {
    config,
    phase: "place",
    fleets: [FLEET.map(() => null), FLEET.map(() => null)],
    ready: [false, false],
    shots: [[], []],
    turn: 0,
    last: null,
    winner: null,
    moves: 0,
  };
}

const fleetOf = (s: State, seat: number) => s.fleets[seat] ?? [];

function legalActions(s: State, seat: number): Action[] {
  if (s.winner !== null || (seat !== 0 && seat !== 1)) return [];
  if (s.phase === "place") {
    if (s.ready[seat]) return [];
    const fleet = fleetOf(s, seat);
    const unplaced = FLEET.flatMap((_, i) => (fleet[i] ? [] : [i]));
    if (unplaced.length === 0) return [{ ready: true }];
    return unplaced.flatMap((i) => placements(fleet, i).map((place) => ({ place })));
  }
  if (seat !== s.turn) return [];
  const shot = new Set((s.shots[seat] ?? []).map((x) => x.cell));
  const out: Action[] = [];
  for (let c = 0; c < CELLS; c++) if (!shot.has(c)) out.push({ fire: c });
  return out;
}

/** While placing: move or turn a ship already placed. */
function sideActions(s: State, seat: number): Action[] {
  if (s.phase !== "place" || s.winner !== null || (seat !== 0 && seat !== 1) || s.ready[seat])
    return [];
  const fleet = fleetOf(s, seat);
  return FLEET.flatMap((_, i) =>
    fleet[i] ? placements(fleet, i).map((place) => ({ place })) : [],
  );
}

function applyAction(s: State, seat: number, action: Action): State {
  if (s.winner !== null || (seat !== 0 && seat !== 1)) return s;
  if ("place" in action) {
    if (s.phase !== "place" || s.ready[seat]) return s;
    const { ship: i, x, y, horizontal } = action.place;
    const fleet = fleetOf(s, seat);
    if (!Number.isInteger(i) || i < 0 || i >= FLEET.length) return s;
    const ship = { x, y, horizontal: horizontal };
    if (!fits(fleet, i, ship)) return s;
    const fleets = s.fleets.map((f, k) =>
      k === seat ? f.map((old, j) => (j === i ? ship : old)) : f,
    );
    return { ...s, fleets, moves: s.moves + 1 };
  }
  if ("ready" in action) {
    if (s.phase !== "place" || s.ready[seat] || fleetOf(s, seat).some((sh) => sh === null))
      return s;
    const ready = s.ready.map((r, k) => r || k === seat);
    return {
      ...s,
      ready,
      phase: ready.every(Boolean) ? "fire" : "place",
      turn: 0,
      moves: s.moves + 1,
    };
  }
  if (s.phase !== "fire" || seat !== s.turn) return s;
  const cell = action.fire;
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELLS) return s;
  const mine = s.shots[seat] ?? [];
  if (mine.some((x) => x.cell === cell)) return s;
  const target = fleetOf(s, other(seat));
  const i = shipAt(target, cell);
  let sunk: number | null = null;
  if (i !== null) {
    const hits = new Set([...mine.filter((x) => x.hit).map((x) => x.cell), cell]);
    const ship = target[i];
    if (ship && (cellsOf(ship, i) ?? []).every((c) => hits.has(c))) sunk = i;
  }
  const shots = s.shots.map((list, k) =>
    k === seat ? [...list, { cell, hit: i !== null, sunk }] : list,
  );
  const next: State = { ...s, shots, last: { seat, index: mine.length }, moves: s.moves + 1 };
  const sunkAll =
    new Set((shots[seat] ?? []).flatMap((x) => (x.sunk === null ? [] : [x.sunk]))).size ===
    FLEET.length;
  if (sunkAll) return { ...next, winner: seat };
  return { ...next, turn: i !== null && s.config.again ? seat : other(seat) };
}

function currentSeats(s: State): number[] {
  if (s.winner !== null) return [];
  if (s.phase === "place") return [0, 1].filter((seat) => !s.ready[seat]);
  return [s.turn];
}

function result(s: State): GameResult | null {
  if (s.winner === null) return null;
  return { completed: true, outcome: [0, 1].map((seat) => (seat === s.winner ? 1 : 0)) };
}

/** Your own fleet; of the other, only the ships you've sunk. */
function view(s: State, seat: number | null): State {
  return {
    ...s,
    fleets: s.fleets.map((fleet, owner) => {
      if (owner === seat) return fleet;
      const sunk = sunkShips(s, owner);
      return fleet.map((ship, i) => (sunk.has(i) ? ship : null));
    }),
  };
}

/** Where the other player put a ship is theirs to know. */
function viewAction(action: Action, seat: number, viewer: number | null): Action | null {
  return "place" in action && viewer !== seat ? null : action;
}

export const engine: TurnEngine<State, Action, Config> = {
  initialState,
  legalActions,
  sideActions,
  applyAction,
  currentSeats,
  result,
  view,
  viewAction,
};
