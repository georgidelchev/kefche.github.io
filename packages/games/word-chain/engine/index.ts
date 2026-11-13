// Word Chain (SPEC §20.7 #69): 2 to 8 players take turns saying a word
// that starts with the last letter of the word before. A word must be in
// the language's dictionary (`lexiconOf`, ADR-0050), three letters or
// more, not blocked, and not said already this game. Stuck? Pass, and lose
// one of your three lives; a clock running out passes for you. A player
// with no lives left is out, and the last one in wins. After 80 words the
// game ends: the most lives left wins, then the most words said.
//
// - The first letter comes from the seed. A word's "last letter" is its
//   last letter that words can start with: in Bulgarian, ь and ъ are passed
//   over for the letter before them.
// - Words are typed, so `accepts` checks them; `legalActions` offers only a
//   pass, for a clock running out or a stand-in.
// Pure and deterministic, given the word lists.
import {
  charsOf,
  lexiconOf,
  Rng,
  wordOf,
  type GameResult,
  type TurnEngine,
} from "@kefche/game-sdk";

export const PACKS = ["en", "bg"] as const;
export type Pack = (typeof PACKS)[number];

export interface Config {
  pack: Pack;
}

export function configFrom(raw: unknown): Config {
  const pack = (raw as { pack?: unknown } | undefined)?.pack;
  return { pack: PACKS.find((p) => p === pack) ?? "en" };
}

export const LIVES = 3;
export const MIN_LENGTH = 3;
export const MAX_WORDS = 80;

/** Letters a word can't be asked to start with: the one before is used. */
const SKIP: Readonly<Record<Pack, string>> = { en: "", bg: "ьъ" };
/** First letters a game may start with (common ones). */
const STARTS: Readonly<Record<Pack, string>> = { en: "abcdefghlmnoprstw", bg: "абвгдекмнопрст" };

export type Action = { word: string } | { pass: true };

export interface State {
  players: number;
  config: Config;
  /** The letter the next word must start with. */
  letter: string;
  /** Words said, in order, and who said each. */
  words: string[];
  by: number[];
  lives: number[];
  turn: number;
  moves: number;
}

/** The letter a word hands on: its last that words can start with. */
export function lastLetter(pack: Pack, word: string): string {
  const chars = charsOf(word);
  for (let i = chars.length - 1; i >= 0; i--) {
    const ch = chars[i] ?? "";
    if (!SKIP[pack].includes(ch)) return ch;
  }
  return chars.at(-1) ?? "";
}

function initialState(raw: Config, seats: number, seed: string): State {
  const config = configFrom(raw);
  const rng = Rng.fromSeed(`word-chain:${seed}`);
  return {
    players: seats,
    config,
    letter: rng.pick(charsOf(STARTS[config.pack])),
    words: [],
    by: [],
    lives: Array.from({ length: seats }, () => LIVES),
    turn: 0,
    moves: 0,
  };
}

const alive = (s: State): number[] => s.lives.flatMap((l, seat) => (l > 0 ? [seat] : []));
export const isOver = (s: State): boolean => alive(s).length <= 1 || s.words.length >= MAX_WORDS;

/** Why a word would or wouldn't do. */
export type Verdict = "ok" | "short" | "letter" | "used" | "unknown";

export function judge(s: State, raw: string): Verdict {
  const pack = s.config.pack;
  const word = wordOf(pack, raw);
  if (word === null || charsOf(word).length < MIN_LENGTH) return "short";
  if (charsOf(word)[0] !== s.letter) return "letter";
  if (s.words.includes(word)) return "used";
  if (!lexiconOf(pack, "all").has(word) || lexiconOf(pack, "blocked").has(word)) return "unknown";
  return "ok";
}

function legalActions(s: State, seat: number): Action[] {
  return !isOver(s) && seat === s.turn ? [{ pass: true }] : [];
}

function accepts(s: State, seat: number, action: unknown): action is Action {
  if (isOver(s) || seat !== s.turn || typeof action !== "object" || action === null) return false;
  if ("pass" in action) return (action as { pass?: unknown }).pass === true;
  const word = (action as { word?: unknown }).word;
  return typeof word === "string" && judge(s, word) === "ok";
}

/** The next player still in after `seat`. */
function nextSeat(lives: readonly number[], seat: number): number {
  for (let k = 1; k <= lives.length; k++) {
    const next = (seat + k) % lives.length;
    if ((lives[next] ?? 0) > 0) return next;
  }
  return seat;
}

function applyAction(s: State, seat: number, action: Action): State {
  if (!accepts(s, seat, action)) return s;
  if ("pass" in action) {
    const lives = s.lives.map((l, i) => (i === seat ? l - 1 : l));
    return { ...s, lives, turn: nextSeat(lives, seat), moves: s.moves + 1 };
  }
  const word = wordOf(s.config.pack, action.word) ?? "";
  return {
    ...s,
    letter: lastLetter(s.config.pack, word),
    words: [...s.words, word],
    by: [...s.by, seat],
    turn: nextSeat(s.lives, seat),
    moves: s.moves + 1,
  };
}

function currentSeats(s: State): number[] {
  return isOver(s) ? [] : [s.turn];
}

/** Words each player said. */
export const wordsBy = (s: State): number[] =>
  s.lives.map((_, seat) => s.by.filter((b) => b === seat).length);

function result(s: State): GameResult | null {
  if (!isOver(s)) return null;
  const said = wordsBy(s);
  // Lives first, then words said.
  const rank = s.lives.map((l, i) => l * 1000 + (said[i] ?? 0));
  const best = Math.max(...rank);
  const top = rank.filter((r) => r === best).length;
  return {
    completed: true,
    outcome: rank.map((r) => (r === best ? (top === 1 ? 1 : 0.5) : 0)),
  };
}

export const engine: TurnEngine<State, Action, Config> = {
  initialState,
  legalActions,
  accepts,
  applyAction,
  currentSeats,
  result,
};
