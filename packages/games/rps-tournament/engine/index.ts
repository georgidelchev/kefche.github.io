// Rock Paper Scissors Tournament (SPEC §20.4 #57): a knockout bracket for
// 2–16 players, each match best of three (or five).
// - The bracket is drawn from the seed; with a number of players that
//   isn't a power of two, the first drawn get a bye.
// - In a match both players throw at once, in secret: rock blunts
//   scissors, scissors cut paper, paper wraps rock; the same throw is
//   thrown again. All of a round's matches go on side by side, and the
//   winners meet in the next round. The last one standing is champion.
// - A match still level after 15 throws goes to whoever has won more, then
//   to the one drawn first.
// A throw waits hidden until the other player in the match has thrown, so
// online the table holds it (ADR-0047).
import { Rng, type GameResult, type TurnEngine } from "@kefche/game-sdk";

export interface Config {
  bestOf: 3 | 5;
}

export function configFrom(raw: unknown): Config {
  return { bestOf: (raw as { bestOf?: unknown } | undefined)?.bestOf === 5 ? 5 : 3 };
}

/** 0 rock, 1 paper, 2 scissors. */
export type Throw = 0 | 1 | 2;
export const THROWS: readonly Throw[] = [0, 1, 2];
/** A throw made but not shown yet (in a view). */
export const SECRET = -1;
const MAX_THROWS = 15;

/** Does `x` beat `y`? */
export const beats = (x: Throw, y: Throw) => (x - y + 3) % 3 === 1;

export interface Match {
  /** The two seats; b is null for a bye. */
  a: number;
  b: number | null;
  wins: [number, number];
  /** Throws shown so far, a's then b's. */
  throws: [Throw, Throw][];
  /** This throw's choices: null not yet, SECRET hidden in a view. */
  pending: [number | null, number | null];
  winner: number | null;
}

export interface State {
  players: number;
  config: Config;
  /** Every round's matches so far; the last is being played. */
  rounds: Match[][];
  champion: number | null;
  moves: number;
}

export interface Action {
  throw: Throw;
}

const match = (a: number, b: number | null): Match => ({
  a,
  b,
  wins: [0, 0],
  throws: [],
  pending: [null, null],
  winner: b === null ? a : null,
});

function initialState(config: Config, seats: number, seed: string): State {
  const order = Rng.fromSeed(seed).shuffle(Array.from({ length: seats }, (_, i) => i));
  let size = 1;
  while (size < seats) size *= 2;
  const byes = size - seats;
  const first: Match[] = [];
  for (let i = 0; i < byes; i++) first.push(match(order[i] ?? 0, null));
  for (let i = byes; i + 1 < seats; i += 2) first.push(match(order[i] ?? 0, order[i + 1] ?? 0));
  return advance({ players: seats, config, rounds: [first], champion: null, moves: 0 });
}

/** When every match of the round is decided: the next round, or the champion. */
function advance(s: State): State {
  const round = s.rounds.at(-1) ?? [];
  if (round.some((m) => m.winner === null)) return s;
  const winners = round.map((m) => m.winner ?? m.a);
  if (winners.length === 1) return { ...s, champion: winners[0] ?? null };
  const next: Match[] = [];
  for (let i = 0; i + 1 < winners.length; i += 2)
    next.push(match(winners[i] ?? 0, winners[i + 1] ?? 0));
  return advance({ ...s, rounds: [...s.rounds, next] });
}

/** The match `seat` is playing now, and which side of it they are. */
export function matchOf(
  s: State,
  seat: number,
): { match: Match; index: number; side: 0 | 1 } | null {
  const round = s.rounds.at(-1) ?? [];
  for (let index = 0; index < round.length; index++) {
    const m = round[index];
    if (m?.winner !== null) continue;
    if (m.a === seat) return { match: m, index, side: 0 };
    if (m.b === seat) return { match: m, index, side: 1 };
  }
  return null;
}

function legalActions(s: State, seat: number): Action[] {
  if (s.champion !== null) return [];
  const mine = matchOf(s, seat);
  if (mine?.match.pending[mine.side] !== null) return [];
  return THROWS.map((t) => ({ throw: t }));
}

function applyAction(s: State, seat: number, action: Action): State {
  const mine = matchOf(s, seat);
  if (s.champion !== null || mine?.match.pending[mine.side] !== null) return s;
  if (!THROWS.includes(action.throw)) return s;
  const m = mine.match;
  const pending: [number | null, number | null] = [...m.pending];
  pending[mine.side] = action.throw;
  let next: Match = { ...m, pending };
  const [x, y] = pending;
  if (x !== null && y !== null) {
    const thrown: [Throw, Throw] = [x as Throw, y as Throw];
    const wins: [number, number] = [...m.wins];
    if (beats(thrown[0], thrown[1])) wins[0]++;
    else if (beats(thrown[1], thrown[0])) wins[1]++;
    const throws = [...m.throws, thrown];
    const need = Math.ceil(s.config.bestOf / 2);
    let winner: number | null = wins[0] >= need ? m.a : wins[1] >= need ? m.b : null;
    if (winner === null && throws.length >= MAX_THROWS) winner = wins[1] > wins[0] ? m.b : m.a;
    next = { ...m, wins, throws, pending: [null, null], winner };
  }
  const round = (s.rounds.at(-1) ?? []).map((old, i) => (i === mine.index ? next : old));
  return advance({ ...s, rounds: [...s.rounds.slice(0, -1), round], moves: s.moves + 1 });
}

function currentSeats(s: State): number[] {
  if (s.champion !== null) return [];
  const round = s.rounds.at(-1) ?? [];
  return round
    .flatMap((m) => {
      if (m.winner !== null || m.b === null) return [];
      return [m.pending[0] === null ? m.a : null, m.pending[1] === null ? m.b : null];
    })
    .filter((seat): seat is number => seat !== null)
    .sort((p, q) => p - q);
}

function result(s: State): GameResult | null {
  if (s.champion === null) return null;
  return {
    completed: true,
    outcome: Array.from({ length: s.players }, (_, i) => (i === s.champion ? 1 : 0)),
  };
}

/** A throw stays hidden from everyone but its thrower until the match shows it. */
function view(s: State, seat: number | null): State {
  return {
    ...s,
    rounds: s.rounds.map((round) =>
      round.map((m) => ({
        ...m,
        pending: [
          m.pending[0] === null || m.a === seat ? m.pending[0] : SECRET,
          m.pending[1] === null || m.b === seat ? m.pending[1] : SECRET,
        ],
      })),
    ),
  };
}

function viewAction(action: Action, seat: number, viewer: number | null): Action | null {
  return viewer === seat ? action : null;
}

export const engine: TurnEngine<State, Action, Config> = {
  initialState,
  legalActions,
  applyAction,
  currentSeats,
  result,
  view,
  viewAction,
};
