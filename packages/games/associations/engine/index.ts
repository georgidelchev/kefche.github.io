// Associations (SPEC §20.4 #55): 2–8 players, 5 or 8 rounds. Each round
// shows a word from the content pack in the game's language ("Beach"), and
// everyone writes, at once and in secret, the word they think the others
// will write. Each player scores a point for every other player who wrote
// the same word, compared after ignoring case, spacing and accents on Latin
// letters. The most points win; a tie is shared.
// Answers are typed, so they can't all be listed: `accepts` checks them,
// and `legalActions` offers only no answer (for a clock running out or a
// stand-in). Answers stay hidden until everyone has written, so online the
// table holds them (ADR-0047). The engine knows prompts by number only.
import { Rng, type GameResult, type TurnEngine } from "@kefche/game-sdk";

export const PACKS = ["en", "bg"] as const;
export type Pack = (typeof PACKS)[number];

export interface Config {
  pack: Pack;
  rounds: 5 | 8;
}

export function configFrom(raw: unknown): Config {
  const r = raw as { pack?: unknown; rounds?: unknown } | undefined;
  return { pack: PACKS.find((p) => p === r?.pack) ?? "en", rounds: r?.rounds === 8 ? 8 : 5 };
}

/** Every pack has this many prompts (checked when the packs are read). */
export const PACK_SIZE = 30;
export const MAX_LENGTH = 24;
/** A prompt still to come (in a view). */
export const HIDDEN = -1;

export interface Round {
  prompt: number;
  answers: string[];
  points: number[];
}

export interface State {
  players: number;
  config: Config;
  /** The prompts of every round, in order (those still to come HIDDEN in a view). */
  prompts: number[];
  /** This round's answers: null not yet; others' hidden (null) in a view. */
  answers: (string | null)[];
  /** Who has answered this round (public). */
  answered: boolean[];
  history: Round[];
  scores: number[];
  moves: number;
}

export interface Action {
  answer: string;
}

/**
 * How answers are compared: case, spaces and punctuation don't count, nor
 * accents on Latin letters ("Café" is "cafe"); Cyrillic and other scripts
 * keep their marks ("й" isn't "и").
 */
export function normalize(word: string): string {
  return word
    .normalize("NFKC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/([a-z])[̀-ͯ]+/g, "$1")
    .normalize("NFC")
    .replace(/[\s'’\-.]+/g, "")
    .trim();
}

/** A typed answer the game takes: letters, digits, spaces, apostrophes and hyphens. */
export const validAnswer = (word: unknown): word is string =>
  typeof word === "string" &&
  word.trim().length > 0 &&
  word.trim().length <= MAX_LENGTH &&
  /^[\p{L}\p{M}\p{N}' ’-]+$/u.test(word.trim()) &&
  normalize(word).length > 0;

function initialState(config: Config, seats: number, seed: string): State {
  const order = Rng.fromSeed(seed).shuffle(Array.from({ length: PACK_SIZE }, (_, i) => i));
  return {
    players: seats,
    config,
    prompts: order.slice(0, config.rounds),
    answers: Array.from({ length: seats }, () => null),
    answered: Array.from({ length: seats }, () => false),
    history: [],
    scores: Array.from({ length: seats }, () => 0),
    moves: 0,
  };
}

const over = (s: State) => s.history.length >= s.config.rounds;
const canAnswer = (s: State, seat: number) =>
  !over(s) && seat >= 0 && seat < s.players && s.answered[seat] === false;

/** Only no answer is listed: what a clock running out or a stand-in gives. */
function legalActions(s: State, seat: number): Action[] {
  return canAnswer(s, seat) ? [{ answer: "" }] : [];
}

function accepts(s: State, seat: number, action: unknown): action is Action {
  const answer = (action as { answer?: unknown } | null)?.answer;
  return canAnswer(s, seat) && (answer === "" || validAnswer(answer));
}

/** Points per seat: one for every other player who wrote the same word. */
export function score(answers: readonly string[]): number[] {
  const keys = answers.map((a) => (a === "" ? "" : normalize(a)));
  return keys.map((k, seat) =>
    k === "" ? 0 : keys.filter((o, other) => other !== seat && o === k).length,
  );
}

function applyAction(s: State, seat: number, action: Action): State {
  if (!accepts(s, seat, action)) return s;
  const answer = action.answer.trim();
  const answers = s.answers.map((a, i) => (i === seat ? answer : a));
  const answered = s.answered.map((d, i) => d || i === seat);
  if (!answered.every(Boolean)) return { ...s, answers, answered, moves: s.moves + 1 };
  const all = answers.map((a) => a ?? "");
  const points = score(all);
  return {
    ...s,
    answers: answers.map(() => null),
    answered: answered.map(() => false),
    history: [...s.history, { prompt: s.prompts[s.history.length] ?? 0, answers: all, points }],
    scores: s.scores.map((v, i) => v + (points[i] ?? 0)),
    moves: s.moves + 1,
  };
}

function currentSeats(s: State): number[] {
  return over(s) ? [] : s.answered.flatMap((d, seat) => (d ? [] : [seat]));
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

/** Other answers this round, and prompts still to come, are hidden. */
function view(s: State, seat: number | null): State {
  return {
    ...s,
    prompts: s.prompts.map((p, i) => (i <= s.history.length ? p : HIDDEN)),
    answers: s.answers.map((a, i) => (i === seat ? a : null)),
  };
}

function viewAction(action: Action, seat: number, viewer: number | null): Action | null {
  return viewer === seat ? action : null;
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
