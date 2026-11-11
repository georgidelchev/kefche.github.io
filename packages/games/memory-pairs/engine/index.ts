// Memory Pairs (Phase 12, TODO #5): Memory Match's cards, taking turns, for
// 2–6 players with bots, on one device or online. Turn two cards over; a
// pair stays up and scores, and its finder goes again; a miss passes the
// turn. The most pairs win. 12, 20 or 30 cards, dealt from the seed.
// The face-down cards are everyone's secret: views show only the cards
// that are up, so online the table holds the layout and turns each card as
// it's chosen (ADR-0047). Memory Match stays the race against the clock.
import {
  SIZES,
  partyFlip,
  partyWinners,
  startParty,
  type Party,
  type Size,
} from "@kefche/game-memory-match/engine";
import type { GameResult, TurnEngine } from "@kefche/game-sdk";

export interface Config {
  cards: Size;
}

export function configFrom(raw: unknown): Config {
  const cards = (raw as { cards?: unknown } | null | undefined)?.cards;
  return { cards: SIZES.find((s) => s === cards) ?? 20 };
}

/** A card's symbol nobody may see now (in a view). */
export const UNSEEN = -1;

export interface State extends Party {
  /** The symbol each card showed the last time it was up, for everyone who watched. */
  seen: number[];
  moves: number;
}

export interface Action {
  flip: number;
}

function initialState(config: Config, seats: number, seed: string): State {
  const party = startParty(config.cards, seats, seed);
  return { ...party, seen: party.symbols.map(() => UNSEEN), moves: 0 };
}

const over = (s: State) => s.matched.every(Boolean);

function legalActions(s: State, seat: number): Action[] {
  if (over(s) || seat !== s.turn) return [];
  const up = s.up.length === 2 ? [] : s.up;
  return s.symbols.flatMap((_, card) =>
    s.matched[card] || up.includes(card) ? [] : [{ flip: card }],
  );
}

function applyAction(s: State, seat: number, action: Action): State {
  if (!legalActions(s, seat).some((a) => a.flip === action.flip)) return s;
  const { party, outcome } = partyFlip(s, action.flip);
  if (outcome === "none") return s;
  const seen = s.seen.map((v, card) => (card === action.flip ? (s.symbols[card] ?? v) : v));
  return { ...s, ...party, seen, moves: s.moves + 1 };
}

function currentSeats(s: State): number[] {
  return over(s) ? [] : [s.turn];
}

function result(s: State): GameResult | null {
  const winners = partyWinners(s);
  if (!winners) return null;
  const share = winners.length === 1 ? 1 : 0.5;
  return {
    completed: true,
    outcome: s.pairs.map((_, seat) => (winners.includes(seat) ? share : 0)),
  };
}

/** Only the cards that are up show their symbols. */
function view(s: State): State {
  return {
    ...s,
    symbols: s.symbols.map((symbol, card) =>
      s.matched[card] || s.up.includes(card) ? symbol : UNSEEN,
    ),
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
