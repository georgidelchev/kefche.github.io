// Liar's Dice (SPEC §20.4 #56): 2–6 players, five dice each, hidden under a
// cup. Points only, never stakes.
// - Everyone rolls in secret. In turn, players bid on how many dice of a
//   face are on the whole table ("five 4s"). Each bid must be higher: more
//   dice, or as many of a higher face.
// - Instead of bidding, call the last bid a lie: every cup is lifted. If
//   there are fewer than bid, the bidder loses a die; if not, the caller
//   does.
// - With "Exact" on, a player may instead call the bid exactly right: if
//   it is, they get a die back (up to five); if not, they lose one.
// - With wild ones (the default), ones count toward every other face; a
//   bid on ones counts only ones.
// - The loser starts the next round, everyone rolls again, and a player
//   with no dice is out. The last with dice wins.
// The dice come from the state's Rng, and views show only your own: online
// the table rolls them and holds every cup (ADR-0047).
import { Rng, type GameResult, type RngState, type TurnEngine } from "@kefche/game-sdk";

export interface Config {
  exact: boolean;
  wild: boolean;
}

export function configFrom(raw: unknown): Config {
  const r = raw as { exact?: unknown; wild?: unknown } | undefined;
  return { exact: r?.exact !== false, wild: r?.wild !== false };
}

export const START = 5;
/** A die nobody may see yet (in a view). */
export const UNSEEN = 0;

export interface Bid {
  qty: number;
  face: number;
}

/** What the cups showed when a bid was called, for showing. */
export interface Reveal {
  dice: number[][];
  bid: Bid;
  bidder: number;
  caller: number;
  call: "liar" | "exact";
  /** How many dice counted for the bid's face. */
  count: number;
  /** Who lost a die, or null when an exact call won one. */
  loser: number | null;
  /** Who got a die back (an exact call), or null. */
  gainer: number | null;
}

export interface State {
  players: number;
  config: Config;
  /** Each seat's dice under its cup (0 in a view for the cups you can't see). */
  dice: number[][];
  turn: number;
  bid: Bid | null;
  bidder: number | null;
  /** This round's bids, in order. */
  history: { seat: number; bid: Bid }[];
  /** The last call, until the next one. */
  reveal: Reveal | null;
  round: number;
  winner: number | null;
  moves: number;
  rng: RngState;
}

export type Action = { bid: Bid } | { call: "liar" } | { call: "exact" };

/** Does this die count for a bid on `face`? */
export const counts = (die: number, face: number, wild: boolean) =>
  die === face || (wild && face !== 1 && die === 1);

export function countFace(
  dice: readonly (readonly number[])[],
  face: number,
  wild: boolean,
): number {
  return dice.reduce((n, cup) => n + cup.filter((d) => counts(d, face, wild)).length, 0);
}

export const totalDice = (s: State) => s.dice.reduce((n, cup) => n + cup.length, 0);

/** Is `b` a legal raise on `over`? */
export const higher = (b: Bid, over: Bid | null) =>
  over === null ? b.qty >= 1 : b.qty > over.qty || (b.qty === over.qty && b.face > over.face);

export const alive = (s: State, seat: number) => (s.dice[seat]?.length ?? 0) > 0;

function nextAlive(s: State, from: number): number {
  for (let i = 1; i <= s.players; i++) {
    const seat = (from + i) % s.players;
    if (alive(s, seat)) return seat;
  }
  return from;
}

function roll(s: State): State {
  const rng = new Rng(s.rng);
  const dice = s.dice.map((cup) => cup.map(() => rng.int(1, 6)));
  return { ...s, dice, rng: rng.state };
}

function initialState(config: Config, seats: number, seed: string): State {
  return roll({
    players: seats,
    config,
    dice: Array.from({ length: seats }, () => Array.from({ length: START }, () => UNSEEN)),
    turn: 0,
    bid: null,
    bidder: null,
    history: [],
    reveal: null,
    round: 1,
    winner: null,
    moves: 0,
    rng: Rng.fromSeed(seed).state,
  });
}

function legalActions(s: State, seat: number): Action[] {
  if (s.winner !== null || seat !== s.turn) return [];
  const out: Action[] = [];
  const total = totalDice(s);
  for (let qty = Math.max(1, s.bid?.qty ?? 1); qty <= total; qty++) {
    for (let face = 1; face <= 6; face++) {
      const bid = { qty, face };
      if (higher(bid, s.bid)) out.push({ bid });
    }
  }
  if (s.bid !== null) {
    out.push({ call: "liar" });
    if (s.config.exact) out.push({ call: "exact" });
  }
  return out;
}

function applyAction(s: State, seat: number, action: Action): State {
  if (s.winner !== null || seat !== s.turn) return s;
  if ("bid" in action) {
    const { qty, face } = action.bid;
    if (!Number.isInteger(qty) || !Number.isInteger(face) || face < 1 || face > 6) return s;
    if (qty > totalDice(s) || !higher(action.bid, s.bid)) return s;
    const bid = { qty, face };
    return {
      ...s,
      bid,
      bidder: seat,
      history: [...s.history, { seat, bid }],
      turn: nextAlive(s, seat),
      moves: s.moves + 1,
    };
  }
  const bid = s.bid;
  const bidder = s.bidder;
  if (bid === null || bidder === null) return s;
  if (action.call === "exact" && !s.config.exact) return s;
  const count = countFace(s.dice, bid.face, s.config.wild);
  let loser: number | null;
  let gainer: number | null = null;
  if (action.call === "liar") loser = count >= bid.qty ? seat : bidder;
  else if (count === bid.qty) {
    loser = null;
    gainer = seat;
  } else loser = seat;
  const dice = s.dice.map((cup, i) => {
    if (i === loser) return cup.slice(1);
    if (i === gainer && cup.length < START) return [...cup, UNSEEN];
    return [...cup];
  });
  const reveal: Reveal = {
    dice: s.dice.map((c) => [...c]),
    bid,
    bidder,
    caller: seat,
    call: action.call,
    count,
    loser,
    gainer,
  };
  const after: State = {
    ...s,
    dice,
    reveal,
    bid: null,
    bidder: null,
    history: [],
    moves: s.moves + 1,
  };
  const left = dice.flatMap((cup, i) => (cup.length > 0 ? [i] : []));
  if (left.length === 1) return { ...after, winner: left[0] ?? 0 };
  // The loser starts the next round (or the player after them, if they're out).
  const starter = loser ?? seat;
  const turn = alive(after, starter) ? starter : nextAlive(after, starter);
  return roll({ ...after, turn, round: s.round + 1 });
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

/** Your own cup only; the others show how many dice they hold. */
function view(s: State, seat: number | null): State {
  return {
    ...s,
    dice: s.dice.map((cup, i) => (i === seat ? cup : cup.map(() => UNSEEN))),
    rng: [0, 0, 0, 0],
  };
}

export const engine: TurnEngine<State, Action, Config> = {
  initialState,
  legalActions,
  applyAction,
  currentSeats,
  result,
  view,
};
