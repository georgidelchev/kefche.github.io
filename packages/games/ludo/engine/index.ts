// Ludo (SPEC §20.1 #4): 2–4 players, four tokens each (or two, for a quick
// game), a track of 52 squares around a cross and a home column of five for
// each colour.
// - The die is rolled for the player each turn. A 6 brings a token out of
//   the yard onto its start square, and gives another roll (but a third 6 in
//   a row ends the turn). Otherwise move one token forward by the die.
// - Landing on a single token of another colour sends it back to its yard,
//   except on the start and star squares, which are safe.
// - A token goes once round, up its home column and home, by an exact roll.
//   The first player with every token home wins.
// The die comes from the state's Rng, which views never show: online the
// table rolls it (ADR-0047).
import { Rng, type GameResult, type RngState, type TurnEngine } from "@kefche/game-sdk";

export interface Config {
  tokens: 4 | 2;
}

export function configFrom(raw: unknown): Config {
  return { tokens: (raw as { tokens?: unknown } | undefined)?.tokens === 2 ? 2 : 4 };
}

/** A token: -1 in the yard, 0–50 along the track from its start, 51–55 up its home column, 56 home. */
export const YARD = -1;
export const HOME = 56;
export const TRACK = 52;

export interface State {
  players: number;
  /** Which colour (0–3, a quarter of the board) each seat plays. */
  colours: number[];
  tokens: number[][];
  turn: number;
  die: number;
  /** Sixes in a row this turn. */
  sixes: number;
  /** The last move, for showing. */
  last: { seat: number; token: number; from: number; to: number; hit: number | null } | null;
  /** Seats whose die couldn't be played this turn, for showing. */
  passed: number | null;
  winner: number | null;
  moves: number;
  rng: RngState;
}

export interface Action {
  token: number;
}

/** Colours by number of players: two play opposite corners. */
const COLOURS: Record<number, number[]> = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

/** The track square (0–51) a token on the track stands on. */
export const square = (colour: number, pos: number): number => (colour * 13 + pos) % TRACK;
export const isSafe = (sq: number) => SAFE.has(sq);

function rollDie(s: State): State {
  const rng = new Rng(s.rng);
  return { ...s, die: rng.int(1, 6), rng: rng.state };
}

function initialState(config: Config, seats: number, seed: string): State {
  const s: State = {
    players: seats,
    colours: COLOURS[seats] ?? [0, 1, 2, 3].slice(0, seats),
    tokens: Array.from({ length: seats }, () => Array.from({ length: config.tokens }, () => YARD)),
    turn: 0,
    die: 0,
    sixes: 0,
    last: null,
    passed: null,
    winner: null,
    moves: 0,
    rng: Rng.fromSeed(seed).state,
  };
  return skipStuck(rollDie(s));
}

/** Where a token would go with the die, or null when it can't move. */
export function destination(s: State, seat: number, token: number): number | null {
  const pos = s.tokens[seat]?.[token];
  if (pos === undefined || pos === HOME) return null;
  if (pos === YARD) return s.die === 6 ? 0 : null;
  const to = pos + s.die;
  return to > HOME ? null : to;
}

export function movable(s: State, seat: number): number[] {
  if (s.winner !== null || seat !== s.turn) return [];
  return (s.tokens[seat] ?? []).flatMap((_, i) => (destination(s, seat, i) === null ? [] : [i]));
}

/** The next player rolls; a roll that can't be played passes on at once. */
function nextTurn(s: State, again: boolean): State {
  const turn = again ? s.turn : (s.turn + 1) % s.players;
  return skipStuck(rollDie({ ...s, turn, sixes: again ? s.sixes : 0 }));
}

function skipStuck(s: State): State {
  let cur = s;
  // Every seat can be stuck at once (all in the yard, no 6): a few passes, never forever.
  for (let i = 0; i < 1000 && movable(cur, cur.turn).length === 0 && cur.winner === null; i++) {
    const turn = (cur.turn + 1) % cur.players;
    cur = rollDie({ ...cur, passed: cur.turn, turn, sixes: 0 });
  }
  return cur;
}

function legalActions(s: State, seat: number): Action[] {
  return movable(s, seat).map((token) => ({ token }));
}

function applyAction(s: State, seat: number, action: Action): State {
  if (!movable(s, seat).includes(action.token)) return s;
  const from = s.tokens[seat]?.[action.token] ?? YARD;
  const to = destination(s, seat, action.token) ?? from;
  const colour = s.colours[seat] ?? 0;
  const tokens = s.tokens.map((t) => [...t]);
  const own = tokens[seat] ?? [];
  own[action.token] = to;
  let hit: number | null = null;
  if (to <= 50) {
    const sq = square(colour, to);
    if (!isSafe(sq)) {
      tokens.forEach((list, other) => {
        if (other === seat) return;
        const oc = s.colours[other] ?? 0;
        const here = list.flatMap((p, i) => (p >= 0 && p <= 50 && square(oc, p) === sq ? [i] : []));
        // A single token is sent home; two together hold the square.
        if (here.length === 1) {
          const i = here[0] ?? 0;
          list[i] = YARD;
          hit = other;
        }
      });
    }
  }
  const won = (tokens[seat] ?? []).every((p) => p === HOME);
  const next: State = {
    ...s,
    tokens,
    last: { seat, token: action.token, from, to, hit },
    passed: null,
    winner: won ? seat : null,
    moves: s.moves + 1,
  };
  if (won) return next;
  const six = s.die === 6;
  const sixes = six ? s.sixes + 1 : 0;
  return nextTurn({ ...next, sixes }, six && sixes < 3);
}

function currentSeats(s: State): number[] {
  return s.winner === null ? [s.turn] : [];
}

function result(s: State): GameResult | null {
  if (s.winner === null) return null;
  return {
    completed: true,
    outcome: Array.from({ length: s.players }, (_, i) => (i === s.winner ? 1 : 0)),
  };
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
