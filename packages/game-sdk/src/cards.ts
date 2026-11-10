// French-suited playing cards for the card games (Phase 12). A card is one
// number, so states, views and logs stay small: suit × 13 + (rank − 2).
// HIDDEN stands for a card the viewer can't see (a face-down card in a view).

import type { Rng } from "./prng";

export const SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;
export type Suit = (typeof SUITS)[number];

/** 2–10, then 11 jack, 12 queen, 13 king, 14 ace. */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export const JACK = 11;
export const QUEEN = 12;
export const KING = 13;
export const ACE = 14;

/** A card: suit index × 13 + (rank − 2), 0–51. */
export type Card = number;
/** A card the viewer may not see. */
export const HIDDEN: Card = -1;

export const card = (suit: Suit, rank: Rank): Card => SUITS.indexOf(suit) * 13 + (rank - 2);
export const suitOf = (c: Card): Suit => SUITS[Math.floor(c / 13)] ?? "clubs";
export const rankOf = (c: Card): Rank => ((c % 13) + 2) as Rank;
export const isRed = (c: Card): boolean => {
  const suit = suitOf(c);
  return suit === "diamonds" || suit === "hearts";
};

/**
 * The decks the card games use, by size: 52 (2 to ace), 36 (6 to ace, Durak),
 * 32 (7 to ace, Belote) and 24 (9 to ace, Santase). Ordered by suit, then rank.
 */
export type DeckSize = 52 | 36 | 32 | 24;
const LOWEST: Record<DeckSize, number> = { 52: 2, 36: 6, 32: 7, 24: 9 };

export function deck(size: DeckSize = 52): Card[] {
  const out: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = LOWEST[size]; rank <= ACE; rank++) out.push(card(suit, rank as Rank));
  }
  return out;
}

/** A shuffled deck: the deal comes from the game's own Rng (its seed). */
export const shuffledDeck = (rng: Rng, size: DeckSize = 52): Card[] => rng.shuffle(deck(size));

/** The same cards, each blanked out: a hand the viewer may only count. */
export const hideCards = (cards: readonly Card[]): Card[] => cards.map(() => HIDDEN);

export interface HandOrder {
  /** Suits left to right; by default alternating colours (clubs, hearts, spades, diamonds). */
  suits?: readonly Suit[];
  /** A rank's strength within its suit, highest last (a game's own: Belote's trumps, say). */
  rank?: (c: Card) => number;
}

const ALTERNATING: readonly Suit[] = ["clubs", "hearts", "spades", "diamonds"];

/** A hand sorted for showing: by suit, then by rank, weakest first. Hidden cards go last. */
export function sortHand(cards: readonly Card[], order: HandOrder = {}): Card[] {
  const suits = order.suits ?? ALTERNATING;
  const strength = order.rank ?? rankOf;
  return [...cards].sort((a, b) => {
    if (a === HIDDEN || b === HIDDEN) return (a === HIDDEN ? 1 : 0) - (b === HIDDEN ? 1 : 0);
    const bySuit = suits.indexOf(suitOf(a)) - suits.indexOf(suitOf(b));
    return bySuit !== 0 ? bySuit : strength(a) - strength(b);
  });
}

/** Removes one copy of each of `cards` from `from`; null when one is missing. */
export function withoutCards(from: readonly Card[], cards: readonly Card[]): Card[] | null {
  const out = [...from];
  for (const c of cards) {
    const i = out.indexOf(c);
    if (i < 0) return null;
    out.splice(i, 1);
  }
  return out;
}

/**
 * Bots that search (Phase 12): a guess at the cards a seat can't see, dealt
 * at random from those still unseen, into the places that hold HIDDEN, so a
 * view becomes one possible state. `unseen` is every card not visible to the
 * bot; `places` the hidden hands' sizes, in order.
 */
export function dealUnseen(rng: Rng, unseen: readonly Card[], places: readonly number[]): Card[][] {
  const pool = rng.shuffle(unseen);
  let at = 0;
  return places.map((n) => {
    const hand = pool.slice(at, at + n);
    at += n;
    return hand;
  });
}
