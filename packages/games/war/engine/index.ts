// War (SPEC §20.2 #16): two players split a shuffled 52-card deck face down.
// Each battle both flip their top card and the higher takes both (aces
// high). On a tie it's war: each lays up to three cards face down and flips
// again, and the next higher card takes the lot. Won cards go under the
// winner's pile in a shuffled order (so a game can't loop forever). A player
// who can't flip loses; after the battles the game was set to, the bigger
// pile wins.
//
// A battle is a simultaneous turn: both seats flip, in either order, and a
// card flipped first stays hidden until the other has flipped too. Piles are
// face down for everyone, so a view shows only their sizes (and no Rng: the
// next shuffles are the table's secret).
import {
  HIDDEN,
  Rng,
  hideCards,
  rankOf,
  shuffledDeck,
  type Card,
  type GameResult,
  type RngState,
  type TurnEngine,
} from "@kefche/game-sdk";

export interface Config {
  /** Battles before the bigger pile wins; 0: until one player has every card. */
  battles: 100 | 300 | 0;
}

/** Even "to the end", a game stops here and the bigger pile wins. */
export const MAX_BATTLES = 1000;
/** Cards laid face down in a war, when a player has them. */
const WAR_DOWN = 3;

export interface Battle {
  /** Each seat's face-up cards, in order: the first flip, then one per war. */
  up: [Card[], Card[]];
  /** Cards each seat laid face down in wars. */
  down: [Card[], Card[]];
  /** The seat that took the cards (null: not decided yet). */
  winner: 0 | 1 | null;
}

export interface State {
  /** Each seat's pile, top card first. */
  piles: [Card[], Card[]];
  /** The battle being fought (cards on the table). */
  battle: Battle;
  /** Who has flipped in this round of it. */
  flipped: [boolean, boolean];
  /** The last decided battle, kept for showing it. */
  last: Battle | null;
  /** Battles decided. */
  battles: number;
  limit: number;
  /** The seat that couldn't flip, when that ended the game. */
  outOfCards: 0 | 1 | null;
  moves: number;
  rng: RngState;
}

export interface Action {
  flip: true;
}
const FLIP: Action = { flip: true };

export function configFrom(raw: unknown): Config {
  const battles = (raw as { battles?: unknown } | undefined)?.battles;
  return { battles: battles === 300 || battles === 0 ? battles : 100 };
}

const emptyBattle = (): Battle => ({ up: [[], []], down: [[], []], winner: null });

export const total = (state: State, seat: 0 | 1): number => state.piles[seat].length;

/** The card that counts for a seat in this battle: its last face-up one. */
const showing = (battle: Battle, seat: 0 | 1): Card | undefined => battle.up[seat].at(-1);

function over(state: State): boolean {
  if (state.outOfCards !== null) return true;
  if (state.battle.up[0].length > 0 || state.battle.up[1].length > 0) return false;
  return state.piles[0].length === 0 || state.piles[1].length === 0 || state.battles >= state.limit;
}

function initialState(config: Config, _seats: number, seed: string): State {
  const rng = Rng.fromSeed(seed);
  const deck = shuffledDeck(rng, 52);
  return {
    piles: [deck.slice(0, 26), deck.slice(26)],
    battle: emptyBattle(),
    flipped: [false, false],
    last: null,
    battles: 0,
    limit: config.battles === 0 ? MAX_BATTLES : config.battles,
    outOfCards: null,
    moves: 0,
    rng: rng.state,
  };
}

/** Both have flipped: someone takes the lot, or it's war. */
function resolve(state: State): State {
  const { battle } = state;
  const a = showing(battle, 0);
  const b = showing(battle, 1);
  if (a === undefined || b === undefined) return state;
  if (rankOf(a) !== rankOf(b)) {
    const winner: 0 | 1 = rankOf(a) > rankOf(b) ? 0 : 1;
    const rng = new Rng(state.rng);
    const won = rng.shuffle([
      ...battle.up[0],
      ...battle.down[0],
      ...battle.up[1],
      ...battle.down[1],
    ]);
    const piles: [Card[], Card[]] = [[...state.piles[0]], [...state.piles[1]]];
    piles[winner] = [...piles[winner], ...won];
    return {
      ...state,
      piles,
      battle: emptyBattle(),
      flipped: [false, false],
      last: { ...battle, winner },
      battles: state.battles + 1,
      rng: rng.state,
    };
  }
  // War: up to three face down each, keeping one to flip. Out of cards: lost.
  const piles: [Card[], Card[]] = [[...state.piles[0]], [...state.piles[1]]];
  const down: [Card[], Card[]] = [[...battle.down[0]], [...battle.down[1]]];
  for (const seat of [0, 1] as const) {
    if (piles[seat].length === 0) return { ...state, outOfCards: seat };
    const laid = Math.min(WAR_DOWN, piles[seat].length - 1);
    down[seat] = [...down[seat], ...piles[seat].slice(0, laid)];
    piles[seat] = piles[seat].slice(laid);
  }
  return { ...state, piles, battle: { ...battle, down }, flipped: [false, false] };
}

function applyAction(state: State, seat: number, action: Action): State {
  if (seat !== 0 && seat !== 1) return state;
  // The only action there is; anything else was refused before it got here.
  if (legalActions(state, seat).length === 0 || typeof action !== "object") return state;
  const card = state.piles[seat][0];
  if (card === undefined) return { ...state, outOfCards: seat, moves: state.moves + 1 };
  const piles: [Card[], Card[]] = [[...state.piles[0]], [...state.piles[1]]];
  piles[seat] = piles[seat].slice(1);
  const up: [Card[], Card[]] = [[...state.battle.up[0]], [...state.battle.up[1]]];
  up[seat] = [...up[seat], card];
  const flipped: [boolean, boolean] = [...state.flipped];
  flipped[seat] = true;
  const next: State = {
    ...state,
    piles,
    battle: { ...state.battle, up },
    flipped,
    moves: state.moves + 1,
  };
  return flipped[0] && flipped[1] ? resolve(next) : next;
}

function legalActions(state: State, seat: number): Action[] {
  if (seat !== 0 && seat !== 1) return [];
  return over(state) || state.flipped[seat] ? [] : [FLIP];
}

function currentSeats(state: State): number[] {
  if (over(state)) return [];
  return ([0, 1] as const).filter((s) => !state.flipped[s]);
}

function result(state: State): GameResult | null {
  if (!over(state)) return null;
  if (state.outOfCards !== null) {
    return { completed: true, outcome: state.outOfCards === 0 ? [0, 1] : [1, 0] };
  }
  const [a, b] = [total(state, 0), total(state, 1)];
  return { completed: true, outcome: a === b ? [0.5, 0.5] : a > b ? [1, 0] : [0, 1] };
}

/**
 * Piles are face down, and a card flipped first stays hidden from the other
 * seat until it flips too (it's a simultaneous turn); its owner sees it. The
 * Rng is never shown.
 */
function view(state: State, seat: number | null): State {
  const up: [Card[], Card[]] = [[...state.battle.up[0]], [...state.battle.up[1]]];
  for (const s of [0, 1] as const) {
    if (s !== seat && state.flipped[s] && !state.flipped[s === 0 ? 1 : 0]) {
      up[s] = [...up[s].slice(0, -1), HIDDEN];
    }
  }
  return {
    ...state,
    piles: [hideCards(state.piles[0]), hideCards(state.piles[1])],
    battle: {
      ...state.battle,
      up,
      down: [hideCards(state.battle.down[0]), hideCards(state.battle.down[1])],
    },
    last: state.last
      ? {
          ...state.last,
          down: [hideCards(state.last.down[0]), hideCards(state.last.down[1])],
        }
      : null,
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
