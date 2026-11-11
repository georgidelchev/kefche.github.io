// Backgammon (SPEC §20.1 #3): two players, 15 checkers each.
// Points are numbered from seat 0's side: index 0 is its 1-point (home is
// 0–5) and it moves toward 0; seat 1 moves the other way (home 18–23).
// - Each turn the dice are rolled for the player (doubles play four times).
//   Move a checker by each die to a point that isn't held by two or more of
//   the other's; landing on a single one hits it to the bar. A checker on
//   the bar must come in first. Use both dice if you can, else the larger.
// - Once all your checkers are home, bear them off: by the exact die, or a
//   higher die from your farthest point.
// - The first to bear off all 15 wins 1 point, 2 for a gammon (the other has
//   borne off none), 3 for a backgammon (and still has one on the bar or in
//   the winner's home), times the cube.
// - The cube (an option): before rolling, offer to double the stakes; the
//   other takes (and owns the cube) or drops (and loses the game at its
//   current value). No doubling in the game after someone first comes
//   within a point of the match (Crawford).
// - A match is played to 1, 3 or 5 points. The opening roll is one die each,
//   no doubles; the higher plays both.
// Dice come from the state's Rng, which views never show: online the table
// rolls them (ADR-0047), so nobody can know the next roll.
import { Rng, type GameResult, type RngState, type TurnEngine } from "@kefche/game-sdk";

export interface Config {
  match: 1 | 3 | 5;
  cube: boolean;
}

export function configFrom(raw: unknown): Config {
  const r = (raw ?? {}) as { match?: unknown; cube?: unknown };
  return { match: r.match === 3 || r.match === 5 ? r.match : 1, cube: r.cube === true };
}

export const BAR = "bar";
export type From = number | typeof BAR;
/** A single checker move: from a point (or the bar) by one die. To -1 or 24 is bearing off. */
export interface Step {
  from: From;
  die: number;
}

export type Action =
  { move: Step } | { roll: true } | { double: true } | { take: true } | { drop: true };

export interface State {
  /** Positive: seat 0's checkers; negative: seat 1's. */
  points: number[];
  bar: [number, number];
  off: [number, number];
  turn: number;
  /** "roll": before rolling (the cube may be offered); "respond": the other answers a double; "move": playing the dice. */
  phase: "roll" | "respond" | "move";
  /** Dice still to play this turn. */
  dice: number[];
  /** The roll this turn started with, for showing. */
  rolled: number[];
  cube: number;
  /** Who may double next: null when the cube is in the middle. */
  cubeOwner: number | null;
  useCube: boolean;
  target: number;
  scores: [number, number];
  /** The Crawford game is being played (no doubling). */
  crawford: boolean;
  crawfordDone: boolean;
  /** The last game's end, for showing. */
  lastGame: {
    winner: number;
    points: number;
    kind: "single" | "gammon" | "backgammon" | "drop";
  } | null;
  moves: number;
  rng: RngState;
}

const dir = (seat: number) => (seat === 0 ? -1 : 1);
const own = (seat: number, n: number) => (seat === 0 ? n > 0 : n < 0);
const count = (seat: number, n: number) => (seat === 0 ? Math.max(0, n) : Math.max(0, -n));
const other = (seat: number) => (seat === 0 ? 1 : 0);

export function startPoints(): number[] {
  const p = Array.from({ length: 24 }, () => 0);
  p[23] = 2;
  p[12] = 5;
  p[7] = 3;
  p[5] = 5;
  p[0] = -2;
  p[11] = -5;
  p[16] = -3;
  p[18] = -5;
  return p;
}

/** Points of the seat's home board, farthest first. */
const homeOf = (seat: number) => (seat === 0 ? [5, 4, 3, 2, 1, 0] : [18, 19, 20, 21, 22, 23]);

function allHome(s: Pick<State, "points" | "bar">, seat: number): boolean {
  if (s.bar[seat as 0 | 1] > 0) return false;
  const home = new Set(homeOf(seat));
  return s.points.every((n, i) => !own(seat, n) || home.has(i));
}

/** Where a step lands: a point index, or "off". Null when it can't be played. */
export function target(
  s: Pick<State, "points" | "bar">,
  seat: number,
  step: Step,
): number | "off" | null {
  const me = seat as 0 | 1;
  if (s.bar[me] > 0 && step.from !== BAR) return null;
  if (step.from === BAR) {
    if (s.bar[me] === 0) return null;
    const to = seat === 0 ? 24 - step.die : step.die - 1;
    return count(other(seat), s.points[to] ?? 0) >= 2 ? null : to;
  }
  const from = step.from;
  if (!own(seat, s.points[from] ?? 0)) return null;
  const to = from + dir(seat) * step.die;
  if (to < 0 || to > 23) {
    if (!allHome(s, seat)) return null;
    // Exact, or higher than needed with nothing farther from home.
    const exact = seat === 0 ? to === -1 : to === 24;
    if (exact) return "off";
    const farther =
      seat === 0
        ? s.points.slice(from + 1, 6).some((n) => own(0, n))
        : s.points.slice(18, from).some((n) => own(1, n));
    return farther ? null : "off";
  }
  return count(other(seat), s.points[to] ?? 0) >= 2 ? null : to;
}

type Board = Pick<State, "points" | "bar" | "off">;

function play(s: Board, seat: number, step: Step): Board {
  const to = target(s, seat, step);
  if (to === null) return s;
  const points = [...s.points];
  const bar: [number, number] = [...s.bar];
  const off: [number, number] = [...s.off];
  const me = seat as 0 | 1;
  const sign = seat === 0 ? 1 : -1;
  if (step.from === BAR) bar[me] -= 1;
  else points[step.from] = (points[step.from] ?? 0) - sign;
  if (to === "off") off[me] += 1;
  else {
    if (count(other(seat), points[to] ?? 0) === 1) {
      points[to] = 0;
      bar[other(seat)] += 1;
    }
    points[to] = (points[to] ?? 0) + sign;
  }
  return { points, bar, off };
}

function stepsFor(s: Board, seat: number, dice: readonly number[]): Step[] {
  const out: Step[] = [];
  for (const die of new Set(dice)) {
    if (s.bar[seat as 0 | 1] > 0) {
      if (target(s, seat, { from: BAR, die }) !== null) out.push({ from: BAR, die });
      continue;
    }
    for (let i = 0; i < 24; i++)
      if (own(seat, s.points[i] ?? 0) && target(s, seat, { from: i, die }) !== null)
        out.push({ from: i, die });
  }
  return out;
}

/** The longest number of dice playable from here. */
function longest(s: Board, seat: number, dice: readonly number[]): number {
  let best = 0;
  for (const step of stepsFor(s, seat, dice)) {
    const rest = [...dice];
    rest.splice(rest.indexOf(step.die), 1);
    best = Math.max(best, 1 + longest(play(s, seat, step), seat, rest));
    if (best === dice.length) break;
  }
  return best;
}

/** Steps that start a maximal play (using as many dice as possible, the larger if only one). */
export function legalSteps(s: State, seat: number): Step[] {
  const steps = stepsFor(s, seat, s.dice);
  if (steps.length === 0) return [];
  const max = longest(s, seat, s.dice);
  let ok = steps.filter((step) => {
    const rest = [...s.dice];
    rest.splice(rest.indexOf(step.die), 1);
    return 1 + longest(play(s, seat, step), seat, rest) === max;
  });
  if (max === 1 && s.dice.length === 2 && s.dice[0] !== s.dice[1]) {
    const high = Math.max(...s.dice);
    if (ok.some((st) => st.die === high)) ok = ok.filter((st) => st.die === high);
  }
  return ok;
}

function roll(rng: Rng): number[] {
  const a = rng.int(1, 6);
  const b = rng.int(1, 6);
  return a === b ? [a, a, a, a] : [a, b];
}

const canDouble = (s: State, seat: number) =>
  s.useCube &&
  !s.crawford &&
  s.target > 1 &&
  (s.cubeOwner === null || s.cubeOwner === seat) &&
  s.scores[seat as 0 | 1] + s.cube < s.target;

/** A new game: the opening roll decides who starts and is their first roll. */
function newGame(
  base: Omit<State, "points" | "bar" | "off" | "turn" | "phase" | "dice" | "rolled" | "rng">,
  rng: Rng,
): State {
  let a = 0;
  let b = 0;
  while (a === b) {
    a = rng.int(1, 6);
    b = rng.int(1, 6);
  }
  const turn = a > b ? 0 : 1;
  return {
    ...base,
    points: startPoints(),
    bar: [0, 0],
    off: [0, 0],
    turn,
    phase: "move",
    dice: [a, b],
    rolled: [a, b],
    cube: 1,
    cubeOwner: null,
    rng: rng.state,
  };
}

function initialState(config: Config, _seats: number, seed: string): State {
  return newGame(
    {
      useCube: config.cube,
      target: config.match,
      scores: [0, 0],
      crawford: false,
      crawfordDone: false,
      lastGame: null,
      moves: 0,
      cube: 1,
      cubeOwner: null,
    },
    Rng.fromSeed(seed),
  );
}

const over = (s: State) => s.scores.some((n) => n >= s.target);

/** The game is won: score it and start the next, or end the match. */
function endGame(
  s: State,
  winner: number,
  points: number,
  kind: NonNullable<State["lastGame"]>["kind"],
): State {
  const scores: [number, number] = [...s.scores];
  scores[winner as 0 | 1] += points;
  const wasCrawford = s.crawford;
  const reaches = !s.crawfordDone && scores.some((n) => n === s.target - 1);
  const after = { ...s, scores, lastGame: { winner, points, kind } };
  if (scores.some((n) => n >= s.target)) return { ...after, phase: "roll" as const, dice: [] };
  return newGame(
    {
      ...after,
      crawford: reaches && !wasCrawford,
      crawfordDone: s.crawfordDone || wasCrawford || reaches,
    },
    new Rng(s.rng),
  );
}

/** The next player's turn: they roll now, unless they may double first. */
function nextTurn(s: State): State {
  const turn = other(s.turn);
  const t: State = { ...s, turn, dice: [], rolled: [] };
  if (canDouble(t, turn)) return { ...t, phase: "roll" };
  return rollFor(t);
}

function rollFor(s: State): State {
  const rng = new Rng(s.rng);
  const dice = roll(rng);
  const t: State = { ...s, phase: "move", dice, rolled: dice, rng: rng.state };
  // Nothing to play: the turn passes at once.
  return legalSteps(t, t.turn).length === 0 ? nextTurn(t) : t;
}

function legalActions(s: State, seat: number): Action[] {
  if (over(s) || seat !== currentSeat(s)) return [];
  if (s.phase === "roll")
    return canDouble(s, seat) ? [{ roll: true }, { double: true }] : [{ roll: true }];
  if (s.phase === "respond") return [{ take: true }, { drop: true }];
  return legalSteps(s, seat).map((step) => ({ move: step }));
}

const currentSeat = (s: State) => (s.phase === "respond" ? other(s.turn) : s.turn);

function applyAction(s: State, seat: number, action: Action): State {
  if (!legalActions(s, seat).some((a) => JSON.stringify(a) === JSON.stringify(action))) return s;
  const moves = s.moves + 1;
  if ("roll" in action) return { ...rollFor(s), moves };
  if ("double" in action) return { ...s, phase: "respond", moves };
  if ("take" in action) return { ...rollFor({ ...s, cube: s.cube * 2, cubeOwner: seat }), moves };
  if ("drop" in action) return { ...endGame(s, s.turn, s.cube, "drop"), moves };
  const board = play(s, seat, action.move);
  const dice = [...s.dice];
  dice.splice(dice.indexOf(action.move.die), 1);
  const t: State = { ...s, ...board, dice, moves };
  if (board.off[seat as 0 | 1] === 15) {
    const loser = other(seat);
    const lost = board.off[loser] === 0;
    const home = new Set(homeOf(seat));
    const stuck = board.bar[loser] > 0 || board.points.some((n, i) => own(loser, n) && home.has(i));
    const kind = !lost ? "single" : stuck ? "backgammon" : "gammon";
    const mult = kind === "single" ? 1 : kind === "gammon" ? 2 : 3;
    return endGame(t, seat, mult * s.cube, kind);
  }
  if (dice.length === 0 || legalSteps(t, seat).length === 0) return nextTurn(t);
  return t;
}

function currentSeats(s: State): number[] {
  return over(s) ? [] : [currentSeat(s)];
}

function result(s: State): GameResult | null {
  if (!over(s)) return null;
  return { completed: true, outcome: s.scores[0] >= s.target ? [1, 0] : [0, 1] };
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

/** Pips each seat still has to move. */
export function pips(s: Pick<State, "points" | "bar">, seat: number): number {
  let n = s.bar[seat as 0 | 1] * 25;
  s.points.forEach((c, i) => {
    if (own(seat, c)) n += count(seat, c) * (seat === 0 ? i + 1 : 24 - i);
  });
  return n;
}

export { play, other };
