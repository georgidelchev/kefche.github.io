// Hangman (SPEC §20.7 #60): 1 to 6 players guess a hidden word a letter at
// a time; six wrong letters and the word is lost. Two ways to play:
//
// - Pack: each round's word comes from the game's themed packs (from the
//   seed), its theme shown. Players take turns guessing; a right letter
//   scores a point for every time it appears and keeps the turn, a wrong
//   one passes it. Revealing the last letter scores 3 more. Alone, it's you
//   against the gallows: solve more than half the words to win.
// - Versus (2 or more): each player in turn sets a word for the others,
//   which must be a word of the language's dictionary (4 to 12 letters, not
//   a blocked word). The others guess as above; the setter scores a point
//   for every wrong letter, and 3 if the word survives.
//
// The most points win (a tie is shared). The word is secret: a view shows
// only its guessed letters (and the setter their own word), so online the
// table holds it (ADR-0047). A set word is typed, so `accepts` checks it,
// with the dictionary (`lexiconOf`, ADR-0050); `legalActions` offers the
// setter only a pack word, for a clock running out or a stand-in.
// Pure and deterministic.
import {
  ALPHABETS,
  charsOf,
  lexiconOf,
  Rng,
  wordOf,
  type GameResult,
  type TurnEngine,
} from "@kefche/game-sdk";

import bg from "../content/bg.json";
import en from "../content/en.json";

export const PACKS = ["en", "bg"] as const;
export type Pack = (typeof PACKS)[number];
export const MODES = ["pack", "versus"] as const;
export type Mode = (typeof MODES)[number];

export interface Config {
  pack: Pack;
  mode: Mode;
  /** Words in a pack game (a versus game has one per player). */
  rounds: 3 | 5;
}

export function configFrom(raw: unknown): Config {
  const r = raw as { pack?: unknown; mode?: unknown; rounds?: unknown } | undefined;
  return {
    pack: PACKS.find((p) => p === r?.pack) ?? "en",
    mode: r?.mode === "versus" ? "versus" : "pack",
    rounds: r?.rounds === 3 ? 3 : 5,
  };
}

export const MAX_MISSES = 6;
export const MIN_LENGTH = 4;
export const MAX_LENGTH = 12;
export const SOLVE_BONUS = 3;
/** A letter not yet guessed, or a pick not yet public, in a view. */
export const HIDDEN = "";
export const HIDDEN_PICK = -1;

export interface PackWord {
  category: number;
  word: string;
}

const flatten = (pack: { categories: { id: string; words: string[] }[] }): PackWord[] =>
  pack.categories.flatMap((c, category) => c.words.map((word) => ({ category, word })));

/** Every pack word, in order (the themes are the packs' categories). */
export const PACK_WORDS: Readonly<Record<Pack, readonly PackWord[]>> = {
  en: flatten(en),
  bg: flatten(bg),
};
/** The themes' ids, the same in every pack. */
export const CATEGORIES = en.categories.map((c) => c.id);

export type Action = { letter: string } | { set: string };

export interface Round {
  word: string;
  category: number | null;
  setter: number | null;
  /** Who revealed the last letter, or null if the word was lost. */
  by: number | null;
  misses: number;
}

export interface State {
  players: number;
  config: Config;
  /** Rounds in this game. */
  rounds: number;
  /** Each round's pack word (versus: the setter's fallback); HIDDEN_PICK in a view. */
  picks: number[];
  round: number;
  phase: "set" | "guess";
  /** Versus: who sets this round's word. */
  setter: number | null;
  /** This round's word, letter by letter; letters not guessed are HIDDEN in a view. */
  word: string[];
  category: number | null;
  /** Letters guessed this round, in order. */
  guessed: string[];
  misses: number;
  /** Whose guess it is. */
  turn: number;
  scores: number[];
  history: Round[];
  moves: number;
}

/** A word a player sets: the dictionary's, 4 to 12 letters, not blocked. */
export function validSecret(pack: Pack, raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const word = wordOf(pack, raw);
  if (word === null) return null;
  const length = charsOf(word).length;
  if (length < MIN_LENGTH || length > MAX_LENGTH) return null;
  if (!lexiconOf(pack, "all").has(word) || lexiconOf(pack, "blocked").has(word)) return null;
  return word;
}

const versus = (s: State): boolean => s.config.mode === "versus" && s.players > 1;
const over = (s: State): boolean => s.round >= s.rounds;

/** The next seat to guess after `seat` (never the setter). */
function nextGuesser(s: State, seat: number): number {
  for (let k = 1; k <= s.players; k++) {
    const next = (seat + k) % s.players;
    if (next !== s.setter) return next;
  }
  return seat;
}

function startRound(s: State, round: number): State {
  if (round >= s.rounds) return { ...s, round };
  const blank = { round, guessed: [], misses: 0 };
  if (versus(s)) {
    const setter = round % s.players;
    return {
      ...s,
      ...blank,
      phase: "set",
      setter,
      word: [],
      category: null,
      turn: (setter + 1) % s.players,
    };
  }
  const pick = PACK_WORDS[s.config.pack][s.picks[round] ?? 0];
  return {
    ...s,
    ...blank,
    phase: "guess",
    setter: null,
    word: charsOf(pick?.word ?? ""),
    category: pick?.category ?? null,
    turn: round % s.players,
  };
}

function initialState(raw: Config, seats: number, seed: string): State {
  const chosen = configFrom(raw);
  const config: Config = seats > 1 ? chosen : { ...chosen, mode: "pack" };
  const pack = PACK_WORDS[config.pack];
  const rounds = config.mode === "versus" ? seats : config.rounds;
  const order = Rng.fromSeed(`hangman:${seed}`).shuffle(pack.map((_, i) => i));
  const base: State = {
    players: seats,
    config,
    rounds,
    picks: order.slice(0, rounds),
    round: 0,
    phase: "guess",
    setter: null,
    word: [],
    category: null,
    guessed: [],
    misses: 0,
    turn: 0,
    scores: Array.from({ length: seats }, () => 0),
    history: [],
    moves: 0,
  };
  return startRound(base, 0);
}

const letters = (pack: Pack): string[] => charsOf(ALPHABETS[pack]);

function legalActions(s: State, seat: number): Action[] {
  if (over(s)) return [];
  if (s.phase === "set") {
    const pick = PACK_WORDS[s.config.pack][s.picks[s.round] ?? HIDDEN_PICK];
    return seat === s.setter && pick ? [{ set: pick.word }] : [];
  }
  if (seat !== s.turn) return [];
  return letters(s.config.pack)
    .filter((l) => !s.guessed.includes(l))
    .map((letter) => ({ letter }));
}

function accepts(s: State, seat: number, action: unknown): action is Action {
  if (over(s) || typeof action !== "object" || action === null) return false;
  if ("set" in action) {
    return (
      s.phase === "set" &&
      seat === s.setter &&
      validSecret(s.config.pack, (action as { set?: unknown }).set) !== null
    );
  }
  const letter = (action as { letter?: unknown }).letter;
  return (
    s.phase === "guess" &&
    seat === s.turn &&
    typeof letter === "string" &&
    letters(s.config.pack).includes(letter) &&
    !s.guessed.includes(letter)
  );
}

function endRound(s: State, by: number | null): State {
  const done: Round = {
    word: s.word.join(""),
    category: s.category,
    setter: s.setter,
    by,
    misses: s.misses,
  };
  return startRound({ ...s, history: [...s.history, done] }, s.round + 1);
}

function applyAction(s: State, seat: number, action: Action): State {
  if (!accepts(s, seat, action)) return s;
  const moved = { ...s, moves: s.moves + 1 };
  if ("set" in action) {
    const word = validSecret(s.config.pack, action.set) ?? "";
    return { ...moved, phase: "guess", word: charsOf(word) };
  }
  const { letter } = action;
  const guessed = [...s.guessed, letter];
  const found = s.word.filter((l) => l === letter).length;
  const scores = [...s.scores];
  if (found > 0) {
    scores[seat] = (scores[seat] ?? 0) + found;
    const solved = s.word.every((l) => guessed.includes(l));
    if (solved) scores[seat] = (scores[seat] ?? 0) + SOLVE_BONUS;
    const next = { ...moved, guessed, scores };
    return solved ? endRound(next, seat) : next;
  }
  const misses = s.misses + 1;
  if (s.setter !== null) scores[s.setter] = (scores[s.setter] ?? 0) + 1;
  if (misses >= MAX_MISSES && s.setter !== null) {
    scores[s.setter] = (scores[s.setter] ?? 0) + SOLVE_BONUS;
  }
  const next = { ...moved, guessed, misses, scores };
  if (misses >= MAX_MISSES) return endRound(next, null);
  return { ...next, turn: nextGuesser(s, seat) };
}

function currentSeats(s: State): number[] {
  if (over(s)) return [];
  return s.phase === "set" && s.setter !== null ? [s.setter] : [s.turn];
}

/** Words solved, for a game alone. */
export const solved = (s: State): number => s.history.filter((r) => r.by !== null).length;

function result(s: State): GameResult | null {
  if (!over(s)) return null;
  if (s.players === 1) return { completed: true, outcome: [solved(s) * 2 > s.rounds ? 1 : 0] };
  const best = Math.max(...s.scores);
  const top = s.scores.filter((v) => v === best).length;
  return {
    completed: true,
    outcome: s.scores.map((v) => (v === best ? (top === 1 ? 1 : 0.5) : 0)),
  };
}

/**
 * The word shows only its guessed letters, except to its setter (and to
 * everyone once the game is over). Picks show only where the viewer will
 * set that word themselves.
 */
function view(s: State, seat: number | null): State {
  if (over(s)) return s;
  const own = s.setter !== null && seat === s.setter;
  return {
    ...s,
    word: own ? s.word : s.word.map((l) => (s.guessed.includes(l) ? l : HIDDEN)),
    picks: s.picks.map((p, i) =>
      versus(s) && i === s.round && seat === s.setter ? p : HIDDEN_PICK,
    ),
  };
}

/** A set word is the setter's own; letters are public. */
function viewAction(action: Action, seat: number, viewer: number | null): Action | null {
  return "set" in action && viewer !== seat ? null : action;
}

export const engine: TurnEngine<State, Action, Config> = {
  initialState,
  legalActions,
  accepts,
  applyAction,
  currentSeats,
  result,
  view,
  viewAction,
};
