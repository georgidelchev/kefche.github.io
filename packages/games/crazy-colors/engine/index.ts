// Crazy Colors (SPEC §20.2 #15): kefche's own shedding game in the Crazy
// Eights family. 2–8 players get 7 cards (or 5). On your turn, play a card
// that matches the colour or the symbol of the top card, or a Wild, which
// names the next colour. Or draw one: play it if it fits, or keep it. Skip
// passes over the next player, Turn reverses the order, and +2 makes the next
// player draw two and miss their turn. The first to play their last card
// wins.
//
// The deck is kefche's own: four colours, each with its own shape (the seat
// palette's first four), 1–9 twice, two each of Skip, Turn and +2, and six
// Wilds: 102 cards. Hands and the draw pile are secret (`view`).
import {
  HIDDEN,
  Rng,
  hideCards,
  type GameResult,
  type RngState,
  type TurnEngine,
} from "@kefche/game-sdk";

export type Colour = 0 | 1 | 2 | 3;
export type Kind = "number" | "skip" | "turn" | "plus2" | "wild";

export interface Face {
  /** null: a Wild. */
  colour: Colour | null;
  kind: Kind;
  /** 1–9 for numbers. */
  n: number;
}

const PER_COLOUR = 24;
export const DECK_SIZE = PER_COLOUR * 4 + 6;

/** What card `id` (0–101) shows. */
export function face(id: number): Face {
  if (id >= PER_COLOUR * 4) return { colour: null, kind: "wild", n: 0 };
  const colour = Math.floor(id / PER_COLOUR) as Colour;
  const i = id % PER_COLOUR;
  if (i < 18) return { colour, kind: "number", n: (i % 9) + 1 };
  const kind: Kind = i < 20 ? "skip" : i < 22 ? "turn" : "plus2";
  return { colour, kind, n: 0 };
}

export interface Config {
  hand: 7 | 5;
}

export function configFrom(raw: unknown): Config {
  return { hand: (raw as { hand?: unknown } | undefined)?.hand === 5 ? 5 : 7 };
}

export interface Last {
  seat: number;
  /** The card played, if one was. */
  card: number | null;
  /** Cards drawn (by choice, or from a +2). */
  drew: number;
  /** A Wild's chosen colour. */
  colour: Colour | null;
  /** The seat a Skip or +2 passed over. */
  skipped: number | null;
}

export interface State {
  players: number;
  hands: number[][];
  /** Top card first. */
  draw: number[];
  /** Top card last. */
  discard: number[];
  /** The colour to match (a Wild's choice, or the top card's). */
  colour: Colour;
  turn: number;
  dir: 1 | -1;
  /** The card the player to move has just drawn: play it or keep it. */
  drawn: number | null;
  last: Last | null;
  winner: number | null;
  moves: number;
  rng: RngState;
}

export type Action = { play: number; colour?: Colour } | { draw: true } | { keep: true };

/** A game with no winner by then ends here; the fewest cards wins. */
export const MAX_MOVES = 3000;

const next = (state: State, from: number, steps = 1): number =>
  (((from + state.dir * steps) % state.players) + state.players) % state.players;

export function fits(state: State, id: number): boolean {
  const f = face(id);
  if (f.kind === "wild") return true;
  const top = state.discard.at(-1);
  if (top === undefined) return true;
  const t = face(top);
  if (f.colour === state.colour) return true;
  return f.kind === "number" ? t.kind === "number" && t.n === f.n : t.kind === f.kind;
}

function initialState(config: Config, seats: number, seed: string): State {
  const rng = Rng.fromSeed(seed);
  let deck = rng.shuffle(Array.from({ length: DECK_SIZE }, (_, i) => i));
  const hands = Array.from({ length: seats }, (_, s) =>
    deck.slice(s * config.hand, (s + 1) * config.hand),
  );
  deck = deck.slice(seats * config.hand);
  // The first card up is a number: anything else goes to the bottom.
  while (face(deck[0] ?? 0).kind !== "number") deck = [...deck.slice(1), deck[0] ?? 0];
  const first = deck[0] ?? 0;
  return {
    players: seats,
    hands,
    draw: deck.slice(1),
    discard: [first],
    colour: face(first).colour ?? 0,
    turn: 0,
    dir: 1,
    drawn: null,
    last: null,
    winner: null,
    moves: 0,
    rng: rng.state,
  };
}

/** Takes `n` cards from the draw pile, shuffling the discards back in when it runs out. */
function drawCards(state: State, n: number): { state: State; cards: number[] } {
  let { draw, discard, rng } = state;
  const cards: number[] = [];
  for (let i = 0; i < n; i++) {
    if (draw.length === 0 && discard.length > 1) {
      const r = new Rng(rng);
      draw = r.shuffle(discard.slice(0, -1));
      rng = r.state;
      discard = discard.slice(-1);
    }
    const card = draw[0];
    if (card === undefined) break;
    cards.push(card);
    draw = draw.slice(1);
  }
  return { state: { ...state, draw, discard, rng }, cards };
}

const over = (state: State) => state.winner !== null || state.moves >= MAX_MOVES;

function legalActions(state: State, seat: number): Action[] {
  if (over(state) || seat !== state.turn) return [];
  const hand = state.hands[seat] ?? [];
  const plays = (ids: readonly number[]): Action[] =>
    [...new Set(ids)]
      .filter((id) => fits(state, id))
      .flatMap((id) =>
        face(id).kind === "wild"
          ? ([0, 1, 2, 3] as const).map((colour): Action => ({ play: id, colour }))
          : [{ play: id }],
      );
  if (state.drawn !== null) return [...plays([state.drawn]), { keep: true }];
  const canDraw = state.draw.length > 0 || state.discard.length > 1;
  const actions = plays(hand);
  if (canDraw) actions.push({ draw: true });
  // Nothing to play and nothing to draw: the turn passes.
  if (actions.length === 0) actions.push({ keep: true });
  return actions;
}

const same = (a: Action, b: Action): boolean =>
  ("play" in a && "play" in b && a.play === b.play && a.colour === b.colour) ||
  ("draw" in a && "draw" in b) ||
  ("keep" in a && "keep" in b);

function applyAction(state: State, seat: number, action: Action): State {
  if (!legalActions(state, seat).some((a) => same(a, action))) return state;
  const moves = state.moves + 1;
  if ("draw" in action) {
    const { state: s, cards } = drawCards(state, 1);
    const card = cards[0] ?? null;
    const hands = s.hands.map((h, i) => (i === seat && card !== null ? [...h, card] : h));
    return {
      ...s,
      hands,
      drawn: card,
      moves,
      last: { seat, card: null, drew: cards.length, colour: null, skipped: null },
    };
  }
  if ("keep" in action) {
    return {
      ...state,
      drawn: null,
      turn: next(state, seat),
      moves,
      last:
        state.drawn !== null
          ? state.last
          : { seat, card: null, drew: 0, colour: null, skipped: null },
    };
  }
  const id = action.play;
  const f = face(id);
  const hand = (state.hands[seat] ?? []).filter((c) => c !== id);
  let s: State = {
    ...state,
    hands: state.hands.map((h, i) => (i === seat ? hand : h)),
    discard: [...state.discard, id],
    colour: f.colour ?? action.colour ?? 0,
    drawn: null,
    moves,
  };
  const last: Last = {
    seat,
    card: id,
    drew: 0,
    colour: f.kind === "wild" ? (action.colour ?? 0) : null,
    skipped: null,
  };
  if (hand.length === 0) return { ...s, winner: seat, last };
  let to = next(s, seat);
  if (f.kind === "turn") {
    s = { ...s, dir: s.dir === 1 ? -1 : 1 };
    // With two players, turning the order round is a skip.
    to = s.players === 2 ? seat : next(s, seat);
  } else if (f.kind === "skip") {
    last.skipped = to;
    to = next(s, seat, 2);
  } else if (f.kind === "plus2") {
    const { state: after, cards } = drawCards(s, 2);
    s = { ...after, hands: after.hands.map((h, i) => (i === to ? [...h, ...cards] : h)) };
    last.skipped = to;
    to = next(s, seat, 2);
  }
  return { ...s, turn: to, last };
}

function currentSeats(state: State): number[] {
  return over(state) ? [] : [state.turn];
}

function result(state: State): GameResult | null {
  if (!over(state)) return null;
  // Out of moves (it can't run forever): the fewest cards wins, ties share it.
  const fewest = Math.min(...state.hands.map((h) => h.length));
  const winners =
    state.winner !== null
      ? [state.winner]
      : state.hands.flatMap((h, i) => (h.length === fewest ? [i] : []));
  return {
    completed: true,
    outcome: state.hands.map((_, i) =>
      winners.includes(i) ? (winners.length === 1 ? 1 : 0.5) : 0,
    ),
  };
}

/** Other hands and the draw pile are face down; the card just drawn is the drawer's secret. */
function view(state: State, seat: number | null): State {
  return {
    ...state,
    hands: state.hands.map((h, i) => (i === seat ? h : hideCards(h))),
    draw: hideCards(state.draw),
    drawn:
      state.drawn !== null && seat === state.turn
        ? state.drawn
        : state.drawn === null
          ? null
          : HIDDEN,
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
