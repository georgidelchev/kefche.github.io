// Durak, Podkidnoy (SPEC §20.2 #20): 2–6 players, 36 cards (6 to ace), six
// each; the next card is turned up as trumps and lies under the deck.
// - A bout: the attacker leads a card; the defender beats it with a higher
//   card of its suit or any trump (a trump only by a higher trump), or takes
//   everything on the table. Once a card is beaten, any attacker (the lead
//   attacker first, then the others in turn) may throw in a card of a rank
//   already on the table, which the defender must beat too. At most six
//   cards are thrown at a defender (five in the first bout), and never more
//   than the defender holds at the start of the bout.
// - When the defender has beaten everything and every attacker passes, the
//   cards are discarded and the defender attacks next. When the defender
//   takes, the attackers may still throw in cards for them to take, and the
//   player after the defender attacks next.
// - Transfers (an option): before beating anything, the defender may add a
//   card of the same rank as the attack, passing it on to the next player.
// - After each bout everyone draws back to six, the lead attacker first and
//   the defender last. With the deck gone, a player with no cards is out.
//   The last player holding cards is the durak, the fool: everyone else wins.
// The first attacker is the player with the lowest trump.
import {
  HIDDEN,
  Rng,
  hideCards,
  rankOf,
  shuffledDeck,
  sortHand,
  suitOf,
  type Card,
  type GameResult,
  type RngState,
  type Suit,
  type TurnEngine,
} from "@kefche/game-sdk";

export interface Config {
  transfer: boolean;
}

export function configFrom(raw: unknown): Config {
  return { transfer: (raw as { transfer?: unknown } | undefined)?.transfer === true };
}

export interface Pair {
  attack: Card;
  defense: Card | null;
}

export interface State {
  players: number;
  hands: Card[][];
  /** Top card first; the last is the face-up trump card. */
  deck: Card[];
  trump: Suit;
  table: Pair[];
  attacker: number;
  defender: number;
  /** "attack": the lead attacker opens; "defend": the defender answers;
   *  "throw": attackers may add; "pile": the defender is taking, attackers may add. */
  phase: "attack" | "defend" | "throw" | "pile";
  /** In "throw" and "pile": whose chance it is to add, and how many passed in a row. */
  turn: number;
  passes: number;
  /** Most attack cards this bout. */
  limit: number;
  firstBout: boolean;
  transfer: boolean;
  /** Seats that are out (no cards, deck gone), in the order they went out. */
  out: number[];
  /** The last bout's end, for showing. */
  lastBout: { defender: number; took: boolean } | null;
  moves: number;
  rng: RngState;
}

export type Action =
  | { attack: Card }
  | { beat: Card }
  | { take: true }
  | { add: Card }
  | { pass: true }
  | { transfer: Card };

const STRENGTH = [6, 7, 8, 9, 10, 11, 12, 13, 14];
export const beats = (trump: Suit, a: Card, b: Card): boolean =>
  suitOf(a) === suitOf(b) ? rankOf(a) > rankOf(b) : suitOf(a) === trump;

const active = (state: State, seat: number) =>
  !state.out.includes(seat) && (state.hands[seat]?.length ?? 0) > 0;

/** The next seat clockwise that still has cards (or `from` itself when none does). */
function nextIn(state: State, from: number): number {
  for (let i = 1; i <= state.players; i++) {
    const s = (from + i) % state.players;
    if (!state.out.includes(s) && ((state.hands[s]?.length ?? 0) > 0 || state.deck.length > 0))
      return s;
  }
  return from;
}

/** Attackers in the order they may throw in: the lead attacker, then clockwise, skipping the defender. */
export function attackers(state: State): number[] {
  const out: number[] = [];
  for (let i = 0; i < state.players; i++) {
    const s = (state.attacker + i) % state.players;
    if (s !== state.defender && active(state, s)) out.push(s);
  }
  return out;
}

function initialState(config: Config, seats: number, seed: string): State {
  const rng = Rng.fromSeed(seed);
  const deck = shuffledDeck(rng, 36);
  const hands = Array.from({ length: seats }, (_, s) => sortHand(deck.slice(s * 6, s * 6 + 6)));
  const rest = deck.slice(seats * 6);
  const trumpCard = rest[0] ?? deck[35] ?? 0;
  const trump = suitOf(trumpCard);
  const stock = [...rest.slice(1), trumpCard];
  // The lowest trump attacks first (seat 0 if nobody has one).
  let first = 0;
  let lowest = 99;
  hands.forEach((h, s) => {
    for (const c of h)
      if (suitOf(c) === trump && rankOf(c) < lowest) {
        lowest = rankOf(c);
        first = s;
      }
  });
  const base: State = {
    players: seats,
    hands,
    deck: stock,
    trump,
    table: [],
    attacker: first,
    defender: (first + 1) % seats,
    phase: "attack",
    turn: first,
    passes: 0,
    limit: 5,
    firstBout: true,
    transfer: config.transfer,
    out: [],
    lastBout: null,
    moves: 0,
    rng: rng.state,
  };
  return { ...base, limit: Math.min(5, base.hands[base.defender]?.length ?? 0) };
}

const ranksOnTable = (state: State) =>
  new Set(
    state.table.flatMap((p) => [p.attack, ...(p.defense === null ? [] : [p.defense])]).map(rankOf),
  );

function over(state: State): boolean {
  const left = Array.from({ length: state.players }, (_, s) => s).filter(
    (s) => !state.out.includes(s),
  );
  return (
    state.deck.length === 0 &&
    state.table.length === 0 &&
    left.filter((s) => (state.hands[s]?.length ?? 0) > 0).length <= 1
  );
}

function currentSeats(state: State): number[] {
  if (over(state)) return [];
  if (state.phase === "attack") return [state.attacker];
  if (state.phase === "defend") return [state.defender];
  return [state.turn];
}

function legalActions(state: State, seat: number): Action[] {
  if (!currentSeats(state).includes(seat)) return [];
  const hand = state.hands[seat] ?? [];
  if (state.phase === "attack") return hand.map((c) => ({ attack: c }));
  if (state.phase === "defend") {
    const open = state.table.find((p) => p.defense === null);
    const actions: Action[] = [{ take: true }];
    if (open)
      for (const c of hand) if (beats(state.trump, c, open.attack)) actions.push({ beat: c });
    // Transfer: nothing beaten yet, every attack card one rank, and the next player can hold it all.
    const rank = rankOf(state.table[0]?.attack ?? 0);
    const next = nextIn(state, state.defender);
    if (
      state.transfer &&
      state.table.every((p) => p.defense === null && rankOf(p.attack) === rank) &&
      next !== state.attacker &&
      (state.hands[next]?.length ?? 0) > state.table.length
    ) {
      for (const c of hand) if (rankOf(c) === rank) actions.push({ transfer: c });
    }
    return actions;
  }
  // Throwing in (or piling on): ranks already on the table, within the limit.
  const actions: Action[] = [{ pass: true }];
  const defenderCards = state.hands[state.defender]?.length ?? 0;
  const unbeaten = state.table.filter((p) => p.defense === null).length;
  const room = state.limit - state.table.length;
  const holds = state.phase === "pile" ? true : defenderCards > unbeaten;
  if (room > 0 && holds) {
    const ranks = ranksOnTable(state);
    for (const c of hand) if (ranks.has(rankOf(c))) actions.push({ add: c });
  }
  return actions;
}

const same = (a: Action, b: Action) => JSON.stringify(a) === JSON.stringify(b);

/** After a bout: everyone draws to six (lead attacker first, defender last), and who's out. */
function endBout(state: State, took: boolean): State {
  const hands = state.hands.map((h) => [...h]);
  const tableCards = state.table.flatMap((p) => [
    p.attack,
    ...(p.defense === null ? [] : [p.defense]),
  ]);
  if (took) hands[state.defender] = sortHand([...(hands[state.defender] ?? []), ...tableCards]);
  let deck = [...state.deck];
  const order = [
    ...attackers({ ...state, hands }).filter((s) => s !== state.defender),
    state.defender,
  ];
  for (const s of order) {
    const need = Math.max(0, 6 - (hands[s]?.length ?? 0));
    const drawn = deck.slice(0, need);
    deck = deck.slice(need);
    hands[s] = sortHand([...(hands[s] ?? []), ...drawn]);
  }
  const out = [...state.out];
  if (deck.length === 0) {
    for (let s = 0; s < state.players; s++)
      if ((hands[s]?.length ?? 0) === 0 && !out.includes(s)) out.push(s);
  }
  const next: State = {
    ...state,
    hands,
    deck,
    table: [],
    out,
    passes: 0,
    firstBout: false,
    lastBout: { defender: state.defender, took },
  };
  // Who attacks next: the defender after a defence, the player after them after a take.
  const lead = took
    ? nextIn(next, state.defender)
    : active(next, state.defender)
      ? state.defender
      : nextIn(next, state.defender);
  const defender = nextIn(next, lead);
  return {
    ...next,
    attacker: lead,
    defender,
    turn: lead,
    phase: "attack",
    limit: Math.min(6, next.hands[defender]?.length ?? 0),
  };
}

/** The next attacker in order who hasn't passed in this round, after `from`. */
function nextThrower(state: State, from: number): number {
  const list = attackers(state);
  const i = list.indexOf(from);
  return list[(i + 1) % Math.max(1, list.length)] ?? from;
}

function applyAction(state: State, seat: number, action: Action): State {
  if (!legalActions(state, seat).some((a) => same(a, action))) return state;
  const moves = state.moves + 1;
  const remove = (c: Card) =>
    state.hands.map((h, i) => (i === seat ? h.filter((x) => x !== c) : h));
  if ("attack" in action) {
    return {
      ...state,
      hands: remove(action.attack),
      table: [{ attack: action.attack, defense: null }],
      phase: "defend",
      moves,
    };
  }
  if ("transfer" in action) {
    const hands = remove(action.transfer);
    const table = [...state.table, { attack: action.transfer, defense: null }];
    const defender = nextIn({ ...state, hands }, state.defender);
    return {
      ...state,
      hands,
      table,
      attacker: state.defender,
      defender,
      limit: Math.min(6, hands[defender]?.length ?? 0),
      moves,
    };
  }
  if ("beat" in action) {
    const hands = remove(action.beat);
    const i = state.table.findIndex((p) => p.defense === null);
    const table = state.table.map((p, j) => (j === i ? { ...p, defense: action.beat } : p));
    const allBeaten = table.every((p) => p.defense !== null);
    if (!allBeaten) return { ...state, hands, table, moves };
    // Everything beaten: the attackers may throw in, the lead attacker first.
    const next = { ...state, hands, table, moves, phase: "throw" as const, passes: 0 };
    const first = attackers(next)[0];
    if (
      first === undefined ||
      (hands[state.defender]?.length ?? 0) === 0 ||
      table.length >= state.limit
    ) {
      return { ...endBout(next, false), moves };
    }
    return { ...next, turn: first };
  }
  if ("take" in action) {
    const next = { ...state, phase: "pile" as const, passes: 0, moves };
    const first = attackers(next)[0];
    if (first === undefined) return { ...endBout(next, true), moves };
    return { ...next, turn: first };
  }
  if ("add" in action) {
    const hands = remove(action.add);
    const table = [...state.table, { attack: action.add, defense: null }];
    if (state.phase === "pile") return { ...state, hands, table, passes: 0, moves };
    return { ...state, hands, table, phase: "defend", passes: 0, moves };
  }
  // A pass: once every attacker has passed in a row, the bout ends.
  const passes = state.passes + 1;
  const count = attackers(state).length;
  if (passes >= count) return { ...endBout({ ...state, moves }, state.phase === "pile"), moves };
  return { ...state, passes, turn: nextThrower(state, seat), moves };
}

function result(state: State): GameResult | null {
  if (!over(state)) return null;
  const left = Array.from({ length: state.players }, (_, s) => s).filter(
    (s) => (state.hands[s]?.length ?? 0) > 0,
  );
  const durak = left[0];
  return {
    completed: true,
    outcome: Array.from({ length: state.players }, (_, s) =>
      durak === undefined ? 0.5 : s === durak ? 0 : 1,
    ),
  };
}

/** Other hands and the deck are face down, but for the trump card under it. */
function view(state: State, seat: number | null): State {
  return {
    ...state,
    hands: state.hands.map((h, i) => (i === seat ? h : hideCards(h))),
    deck: state.deck.map((c, i) => (i === state.deck.length - 1 ? c : HIDDEN)),
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

export const RANKS = STRENGTH;
