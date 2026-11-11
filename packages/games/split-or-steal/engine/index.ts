// Split or Steal (SPEC §20.4 #59): 2–10 players, points only, never
// stakes. Each round the players are paired (one sits out when they're an
// odd number), and each pair has a pot: 10 points in round 1, 20 in round
// 2, and so on. Talk it over (in the room's chat, or aloud on one device),
// then both choose at once, in secret:
// - both split: half each;
// - one steals: the stealer takes it all, the splitter gets nothing;
// - both steal: nobody gets anything.
// After 3 or 5 rounds the most points win; a tie is shared. Pairings turn
// like a round robin, so you meet different players.
// A choice stays hidden until the pair's other player has chosen, so
// online the table holds it (ADR-0047).
import type { GameResult, TurnEngine } from "@kefche/game-sdk";

export interface Config {
  rounds: 3 | 5;
}

export function configFrom(raw: unknown): Config {
  return { rounds: (raw as { rounds?: unknown } | undefined)?.rounds === 5 ? 5 : 3 };
}

export type Choice = "split" | "steal";
/** A choice made but not shown yet (in a view). */
export const SECRET = "secret";
export const POT = 10;

export interface Pair {
  a: number;
  b: number;
  pot: number;
  /** null not yet, SECRET hidden in a view. */
  choices: [Choice | typeof SECRET | null, Choice | typeof SECRET | null];
  /** Points each won, once both have chosen. */
  won: [number, number] | null;
}

export interface State {
  players: number;
  config: Config;
  round: number;
  pairs: Pair[];
  /** Who sits out this round, if anyone. */
  out: number | null;
  /** Every finished round's pairs. */
  history: Pair[][];
  scores: number[];
  moves: number;
}

export interface Action {
  choose: Choice;
}

/** Round-robin pairings for round r (0-based): the circle method. */
export function pairings(
  players: number,
  r: number,
): { pairs: [number, number][]; out: number | null } {
  const ring = Array.from({ length: players % 2 === 0 ? players : players + 1 }, (_, i) => i);
  const n = ring.length;
  // Fix the first seat and turn the rest.
  const rest = ring.slice(1);
  const k = r % (n - 1);
  const turned = [...rest.slice(rest.length - k), ...rest.slice(0, rest.length - k)];
  const order = [ring[0] ?? 0, ...turned];
  const pairs: [number, number][] = [];
  let out: number | null = null;
  for (let i = 0; i < n / 2; i++) {
    const a = order[i] ?? 0;
    const b = order[n - 1 - i] ?? 0;
    if (a >= players) out = b;
    else if (b >= players) out = a;
    else pairs.push(a < b ? [a, b] : [b, a]);
  }
  return { pairs, out };
}

function startRound(s: Omit<State, "pairs" | "out">): State {
  const { pairs, out } = pairings(s.players, s.round);
  return {
    ...s,
    pairs: pairs.map(([a, b]) => ({
      a,
      b,
      pot: POT * (s.round + 1),
      choices: [null, null],
      won: null,
    })),
    out,
  };
}

function initialState(config: Config, seats: number): State {
  return startRound({
    players: seats,
    config,
    round: 0,
    history: [],
    scores: Array.from({ length: seats }, () => 0),
    moves: 0,
  });
}

const over = (s: State) => s.round >= s.config.rounds;

export function pairOf(s: State, seat: number): { pair: Pair; index: number; side: 0 | 1 } | null {
  for (let index = 0; index < s.pairs.length; index++) {
    const pair = s.pairs[index];
    if (!pair) continue;
    if (pair.a === seat) return { pair, index, side: 0 };
    if (pair.b === seat) return { pair, index, side: 1 };
  }
  return null;
}

function legalActions(s: State, seat: number): Action[] {
  const mine = pairOf(s, seat);
  if (over(s) || mine?.pair.choices[mine.side] !== null) return [];
  return [{ choose: "split" }, { choose: "steal" }];
}

/** What a pair's choices win each of them. */
export function payout(pot: number, a: Choice, b: Choice): [number, number] {
  if (a === "split" && b === "split") return [pot / 2, pot / 2];
  if (a === "steal" && b === "split") return [pot, 0];
  if (a === "split" && b === "steal") return [0, pot];
  return [0, 0];
}

function applyAction(s: State, seat: number, action: Action): State {
  const mine = pairOf(s, seat);
  if (over(s) || mine?.pair.choices[mine.side] !== null) return s;
  // Moves arrive from the network: check the value, whatever the type says.
  if (!(["split", "steal"] as readonly unknown[]).includes(action.choose)) return s;
  const choices: Pair["choices"] = [...mine.pair.choices];
  choices[mine.side] = action.choose;
  const [x, y] = choices;
  const won = x !== null && y !== null ? payout(mine.pair.pot, x as Choice, y as Choice) : null;
  const pair: Pair = { ...mine.pair, choices, won };
  const pairs = s.pairs.map((p, i) => (i === mine.index ? pair : p));
  const scores = won
    ? s.scores.map((v, i) => v + (i === pair.a ? won[0] : i === pair.b ? won[1] : 0))
    : s.scores;
  const next: State = { ...s, pairs, scores, moves: s.moves + 1 };
  if (pairs.some((p) => p.won === null)) return next;
  return startRound({ ...next, round: s.round + 1, history: [...s.history, pairs] });
}

function currentSeats(s: State): number[] {
  if (over(s)) return [];
  return s.pairs
    .flatMap((p) => [p.choices[0] === null ? p.a : null, p.choices[1] === null ? p.b : null])
    .filter((seat): seat is number => seat !== null)
    .sort((x, y) => x - y);
}

function result(s: State): GameResult | null {
  if (!over(s)) return null;
  const best = Math.max(...s.scores);
  const top = s.scores.filter((v) => v === best).length;
  return {
    completed: true,
    outcome: s.scores.map((v) => (v === best ? (top === 1 ? 1 : 0.5) : 0)),
  };
}

/** A choice stays hidden from everyone but its chooser until the pair's both are in. */
function view(s: State, seat: number | null): State {
  return {
    ...s,
    pairs: s.pairs.map((p) =>
      p.won !== null
        ? p
        : {
            ...p,
            choices: [
              p.choices[0] === null || p.a === seat ? p.choices[0] : SECRET,
              p.choices[1] === null || p.b === seat ? p.choices[1] : SECRET,
            ],
          },
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
