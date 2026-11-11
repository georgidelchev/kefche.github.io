// Hearts (SPEC §20.2 #19): four players, 13 cards each, no trumps.
// - Passing: three cards to the left, then right, then across, then no
//   pass, and again. Everyone chooses at once (a simultaneous turn), and
//   the cards change hands when all have chosen.
// - Play: the two of clubs leads the first trick; follow suit if you can;
//   the highest card of the suit led takes the trick and leads the next.
//   No hearts or queen of spades on the first trick unless you have nothing
//   else, and hearts can't be led until one has been played (or you hold
//   only hearts).
// - Points: a heart is 1, the queen of spades 13. Taking all 26 is
//   shooting the moon: everyone else gets 26 instead.
// - The game ends when someone reaches 100 (or 50); the lowest score wins.
import {
  HIDDEN,
  QUEEN,
  Rng,
  card,
  hideCards,
  rankOf,
  shuffledDeck,
  sortHand,
  suitOf,
  withoutCards,
  type Card,
  type GameResult,
  type RngState,
  type TurnEngine,
} from "@kefche/game-sdk";

export interface Config {
  target: 100 | 50;
}

export function configFrom(raw: unknown): Config {
  return { target: (raw as { target?: unknown } | undefined)?.target === 50 ? 50 : 100 };
}

export const SEATS = 4;
export const TWO_OF_CLUBS = card("clubs", 2);
export const QUEEN_OF_SPADES = card("spades", QUEEN);
/** Passing, hand by hand: left, right, across, none (hold). */
export const PASS_OFFSETS = [1, 3, 2, 0] as const;

export interface Play {
  seat: number;
  card: Card;
}

export interface State {
  hands: Card[][];
  phase: "pass" | "play";
  /** Hand number from 0: which way the cards pass. */
  hand: number;
  /** Each seat's three cards to pass, once chosen (null: still choosing). */
  passes: (Card[] | null)[];
  /** The cards each seat received this hand (shown to it until its first play). */
  received: Card[][];
  trick: Play[];
  /** The last complete trick and who took it, for showing. */
  lastTrick: { plays: Play[]; winner: number } | null;
  turn: number;
  heartsBroken: boolean;
  /** Points taken this hand. */
  taken: number[];
  scores: number[];
  /** The last hand's points (moon included), for showing. */
  lastHand: number[] | null;
  target: number;
  moves: number;
  rng: RngState;
}

export type Action = { pass: Card[] } | { play: Card };

export const points = (c: Card): number =>
  c === QUEEN_OF_SPADES ? 13 : suitOf(c) === "hearts" ? 1 : 0;

export const passOffset = (state: State): number => PASS_OFFSETS[state.hand % 4] ?? 0;

function deal(state: Omit<State, "hands" | "rng">, rng: Rng): State {
  const deck = shuffledDeck(rng, 52);
  const hands = Array.from({ length: SEATS }, (_, s) => sortHand(deck.slice(s * 13, s * 13 + 13)));
  const holding = PASS_OFFSETS[state.hand % 4] === 0;
  const leader = hands.findIndex((h) => h.includes(TWO_OF_CLUBS));
  return {
    ...state,
    hands,
    phase: holding ? "play" : "pass",
    passes: Array.from({ length: SEATS }, () => null),
    received: Array.from({ length: SEATS }, () => []),
    trick: [],
    turn: leader,
    heartsBroken: false,
    taken: [0, 0, 0, 0],
    rng: rng.state,
  };
}

function initialState(config: Config, _seats: number, seed: string): State {
  return deal(
    {
      phase: "pass",
      hand: 0,
      passes: [],
      received: [],
      trick: [],
      lastTrick: null,
      turn: 0,
      heartsBroken: false,
      taken: [],
      scores: [0, 0, 0, 0],
      lastHand: null,
      target: config.target,
      moves: 0,
    },
    Rng.fromSeed(seed),
  );
}

/** No trick has been taken yet this hand. */
const firstTrick = (state: State) =>
  state.hands.reduce((n, h) => n + h.length, 0) + state.trick.length === 52;

/** The cards `seat` may play now. */
export function playable(state: State, seat: number): Card[] {
  const hand = state.hands[seat] ?? [];
  const led = state.trick[0];
  if (!led) {
    if (firstTrick(state)) return hand.includes(TWO_OF_CLUBS) ? [TWO_OF_CLUBS] : [];
    const safe = hand.filter((c) => suitOf(c) !== "hearts");
    return state.heartsBroken || safe.length === 0 ? hand : safe;
  }
  const follow = hand.filter((c) => suitOf(c) === suitOf(led.card));
  if (follow.length > 0) return follow;
  if (firstTrick(state)) {
    const clean = hand.filter((c) => points(c) === 0);
    if (clean.length > 0) return clean;
  }
  return hand;
}

/** Every way to choose 3 of `hand`, each sorted, in a fixed order. */
function threes(hand: readonly Card[]): Card[][] {
  const sorted = [...hand].sort((a, b) => a - b);
  const out: Card[][] = [];
  for (let i = 0; i < sorted.length; i++)
    for (let j = i + 1; j < sorted.length; j++)
      for (let k = j + 1; k < sorted.length; k++)
        out.push([sorted[i] ?? 0, sorted[j] ?? 0, sorted[k] ?? 0]);
  return out;
}

const over = (state: State) => state.scores.some((s) => s >= state.target);

function legalActions(state: State, seat: number): Action[] {
  if (over(state) || seat < 0 || seat >= SEATS) return [];
  if (state.phase === "pass") {
    return state.passes[seat] === null
      ? threes(state.hands[seat] ?? []).map((pass) => ({ pass }))
      : [];
  }
  return seat === state.turn ? playable(state, seat).map((c) => ({ play: c })) : [];
}

function trickWinner(plays: readonly Play[]): number {
  const led = plays[0];
  if (!led) return 0;
  let best = led;
  for (const p of plays) {
    if (suitOf(p.card) === suitOf(led.card) && rankOf(p.card) > rankOf(best.card)) best = p;
  }
  return best.seat;
}

function applyAction(state: State, seat: number, action: Action): State {
  const moves = state.moves + 1;
  if ("pass" in action) {
    if (state.phase !== "pass" || state.passes[seat] !== null) return state;
    const chosen = [...action.pass].sort((a, b) => a - b);
    const hand = state.hands[seat] ?? [];
    if (chosen.length !== 3 || new Set(chosen).size !== 3 || withoutCards(hand, chosen) === null)
      return state;
    const passes = state.passes.map((p, i) => (i === seat ? chosen : p));
    if (passes.some((p) => p === null)) return { ...state, passes, moves };
    // Everyone has chosen: the cards change hands.
    const offset = passOffset(state);
    const received: Card[][] = Array.from(
      { length: SEATS },
      (_, to) => passes[(to - offset + SEATS) % SEATS] ?? [],
    );
    const hands = state.hands.map((h, i) =>
      sortHand([...(withoutCards(h, passes[i] ?? []) ?? h), ...(received[i] ?? [])]),
    );
    return {
      ...state,
      hands,
      passes,
      received,
      phase: "play",
      turn: hands.findIndex((h) => h.includes(TWO_OF_CLUBS)),
      moves,
    };
  }
  if (state.phase !== "play" || seat !== state.turn || !playable(state, seat).includes(action.play))
    return state;
  const hands = state.hands.map((h, i) => (i === seat ? h.filter((c) => c !== action.play) : h));
  const trick = [...state.trick, { seat, card: action.play }];
  const heartsBroken = state.heartsBroken || suitOf(action.play) === "hearts";
  if (trick.length < SEATS) {
    return {
      ...state,
      hands,
      trick,
      heartsBroken,
      turn: (seat + 1) % SEATS,
      received: state.received.map(() => []),
      moves,
    };
  }
  const winner = trickWinner(trick);
  const taken = state.taken.map((t, i) =>
    i === winner ? t + trick.reduce((n, p) => n + points(p.card), 0) : t,
  );
  const next: State = {
    ...state,
    hands,
    trick: [],
    lastTrick: { plays: trick, winner },
    heartsBroken,
    taken,
    turn: winner,
    moves,
  };
  if (hands.some((h) => h.length > 0)) return next;
  // The hand is over: shooting the moon, then the next deal.
  const moon = taken.findIndex((t) => t === 26);
  const scored = moon >= 0 ? taken.map((_, i) => (i === moon ? 0 : 26)) : taken;
  const scores = state.scores.map((s, i) => s + (scored[i] ?? 0));
  const after = { ...next, scores, lastHand: scored };
  if (scores.some((s) => s >= state.target)) return { ...after, hand: state.hand + 1 };
  return deal({ ...after, hand: state.hand + 1 }, new Rng(state.rng));
}

function currentSeats(state: State): number[] {
  if (over(state)) return [];
  if (state.phase === "pass") return state.passes.flatMap((p, i) => (p === null ? [i] : []));
  return [state.turn];
}

function result(state: State): GameResult | null {
  if (!over(state)) return null;
  const low = Math.min(...state.scores);
  const winners = state.scores.filter((s) => s === low).length;
  return {
    completed: true,
    outcome: state.scores.map((s) => (s === low ? (winners === 1 ? 1 : 0.5) : 0)),
  };
}

/** Other hands, other seats' passes and what they received are secret; so is the Rng. */
function view(state: State, seat: number | null): State {
  return {
    ...state,
    hands: state.hands.map((h, i) => (i === seat ? h : hideCards(h))),
    passes: state.passes.map((p, i) => (p === null || i === seat ? p : hideCards(p))),
    received: state.received.map((r, i) => (i === seat ? r : hideCards(r))),
    rng: [0, 0, 0, 0],
  };
}

/** A pass is seen only by the one who made it. */
function viewAction(action: Action, seat: number, viewer: number | null): Action | null {
  return "pass" in action && seat !== viewer ? { pass: [HIDDEN, HIDDEN, HIDDEN] } : action;
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
