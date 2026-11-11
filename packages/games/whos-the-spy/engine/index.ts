// Who's the Spy (SPEC §20.4 #53): 3–10 players. Everyone is told the same
// location (from the content pack in the game's language), except one: the
// spy, who isn't.
// - Talk: players ask each other questions, in the room's chat or aloud on
//   one device, trying to find the spy without giving the place away; the
//   spy tries to blend in and to work out where they are. Each player says
//   when they're ready to vote.
// - At any moment the spy may stop and name the location: right, the spy
//   wins; wrong, everyone else does.
// - Vote: everyone votes, in secret, for who they think is the spy. If the
//   most votes (no tie) land on the spy, the spy still gets one guess at the
//   location; right, the spy wins, otherwise everyone else does. If they
//   land on anyone else, or tie, the spy wins.
// The location, the spy and the votes are secret, so online the table holds
// them (ADR-0047). Locations are numbered; the words come from the packs.
import { Rng, type GameResult, type TurnEngine } from "@kefche/game-sdk";

export const PACKS = ["en", "bg"] as const;
export type Pack = (typeof PACKS)[number];

export interface Config {
  pack: Pack;
}

export function configFrom(raw: unknown): Config {
  const pack = (raw as { pack?: unknown } | undefined)?.pack;
  return { pack: PACKS.find((p) => p === pack) ?? "en" };
}

/** Every pack has this many locations (checked when the packs are read). */
export const PACK_SIZE = 30;
/** Not shown to this viewer (in a view). */
export const HIDDEN = -1;

export interface State {
  players: number;
  config: Config;
  phase: "talk" | "vote" | "guess";
  /** Index into the pack, HIDDEN for the spy and onlookers in a view. */
  location: number;
  /** The spy's seat, HIDDEN in a view to everyone but the spy. */
  spy: number;
  ready: boolean[];
  /** Each seat's vote: null not yet, HIDDEN in a view until all are in. */
  votes: (number | null)[];
  /** Who the vote fell on, once it's counted (null on a tie). */
  accused: number | null;
  /** The spy's guess, when there was one. */
  guess: number | null;
  /** Who won: the spy, or everyone else. */
  winner: "spy" | "others" | null;
  moves: number;
}

export type Action = { ready: true } | { vote: number } | { guess: number };

function initialState(config: Config, seats: number, seed: string): State {
  const rng = Rng.fromSeed(seed);
  return {
    players: seats,
    config,
    phase: "talk",
    location: rng.int(0, PACK_SIZE - 1),
    spy: rng.int(0, seats - 1),
    ready: Array.from({ length: seats }, () => false),
    votes: Array.from({ length: seats }, () => null),
    accused: null,
    guess: null,
    winner: null,
    moves: 0,
  };
}

const guesses = (): Action[] => Array.from({ length: PACK_SIZE }, (_, guess) => ({ guess }));

function legalActions(s: State, seat: number): Action[] {
  if (s.winner !== null || seat < 0 || seat >= s.players) return [];
  if (s.phase === "talk") return s.ready[seat] ? [] : [{ ready: true }];
  if (s.phase === "vote") {
    if (s.votes[seat] !== null) return [];
    return Array.from({ length: s.players }, (_, v) => v).flatMap((v) =>
      v === seat ? [] : [{ vote: v }],
    );
  }
  return seat === s.spy ? guesses() : [];
}

/** The spy may name the location at any moment of the talk, without waiting. */
function sideActions(s: State, seat: number): Action[] {
  return s.winner === null && s.phase === "talk" && seat === s.spy ? guesses() : [];
}

/** The seat with the most votes, or null on a tie. */
export function countVotes(votes: readonly (number | null)[], players: number): number | null {
  const tally = Array.from({ length: players }, () => 0);
  for (const v of votes) if (v !== null && v >= 0) tally[v] = (tally[v] ?? 0) + 1;
  const best = Math.max(...tally);
  const top = tally.flatMap((n, seat) => (n === best ? [seat] : []));
  return top.length === 1 ? (top[0] ?? null) : null;
}

function applyAction(s: State, seat: number, action: Action): State {
  if (s.winner !== null) return s;
  const moved = { ...s, moves: s.moves + 1 };
  if ("guess" in action) {
    const legal = (s.phase === "talk" || s.phase === "guess") && seat === s.spy;
    if (!legal || !Number.isInteger(action.guess) || action.guess < 0 || action.guess >= PACK_SIZE)
      return s;
    return {
      ...moved,
      guess: action.guess,
      winner: action.guess === s.location ? "spy" : "others",
    };
  }
  if ("ready" in action) {
    if (s.phase !== "talk" || s.ready[seat] !== false) return s;
    const ready = s.ready.map((r, i) => r || i === seat);
    return { ...moved, ready, phase: ready.every(Boolean) ? "vote" : "talk" };
  }
  if (s.phase !== "vote" || s.votes[seat] !== null) return s;
  if (
    !Number.isInteger(action.vote) ||
    action.vote < 0 ||
    action.vote >= s.players ||
    action.vote === seat
  )
    return s;
  const votes = s.votes.map((v, i) => (i === seat ? action.vote : v));
  if (votes.some((v) => v === null)) return { ...moved, votes };
  const accused = countVotes(votes, s.players);
  if (accused === s.spy) return { ...moved, votes, accused, phase: "guess" };
  return { ...moved, votes, accused, winner: "spy" };
}

function currentSeats(s: State): number[] {
  if (s.winner !== null) return [];
  if (s.phase === "talk") return s.ready.flatMap((r, seat) => (r ? [] : [seat]));
  if (s.phase === "vote") return s.votes.flatMap((v, seat) => (v === null ? [seat] : []));
  return [s.spy];
}

function result(s: State): GameResult | null {
  if (s.winner === null) return null;
  return {
    completed: true,
    outcome: Array.from({ length: s.players }, (_, seat) =>
      (seat === s.spy) === (s.winner === "spy") ? 1 : 0,
    ),
  };
}

/**
 * The spy knows they're the spy but not the place; everyone else knows the
 * place but not the spy. Votes stay hidden until all are in. Once the spy
 * is accused and must guess, the accusation is public, and so is the spy.
 */
function view(s: State, seat: number | null): State {
  const spyKnown = s.phase === "guess" || s.winner !== null;
  const isSpy = seat !== null && seat === s.spy;
  return {
    ...s,
    location: seat !== null && !isSpy ? s.location : HIDDEN,
    spy: isSpy || spyKnown ? s.spy : HIDDEN,
    votes:
      s.phase === "vote" ? s.votes.map((v, i) => (v === null || i === seat ? v : HIDDEN)) : s.votes,
  };
}

function viewAction(action: Action, seat: number, viewer: number | null): Action | null {
  return "vote" in action && viewer !== seat ? null : action;
}

export const engine: TurnEngine<State, Action, Config> = {
  initialState,
  legalActions,
  sideActions,
  applyAction,
  currentSeats,
  result,
  view,
  viewAction,
};
