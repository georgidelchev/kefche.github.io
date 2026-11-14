// Categories (SPEC §20.7 #67): 2 to 10 players, a letter each round, and a
// country, a city, an animal and so on that start with it, answered by
// everyone at the same time. Six of the eight categories are drawn for a
// game, and kept for all its rounds.
//
// - Answering: each player sends a sheet, one answer for each category (an
//   empty one is allowed). Sheets stay hidden until everyone has sent one.
// - Checking: an answer that's empty, doesn't start with the letter or is a
//   blocked word scores nothing. One in the language's pack of known answers
//   for its category counts. Any other is doubtful, and the room votes on it.
// - Voting: everyone but its author votes on each doubtful answer, at the
//   same time and in secret; it counts unless most of them vote it out.
// - Scoring: for each category, an answer nobody else gave scores 10, and
//   one shared with others (the same, letter for letter) scores 5 each.
//
// The most points after the last round win (a tie is shared). Online the
// table holds the sheets and votes (ADR-0047). A typed sheet is checked by
// `accepts`; `legalActions` lists only an empty sheet, or a ballot that lets
// everything in, for a clock running out or a stand-in. Pure and
// deterministic; the blocklist comes from the language's word lists
// (`lexiconOf`, ADR-0050).
import {
  charsOf,
  lettersOf,
  lexiconOf,
  Rng,
  type GameResult,
  type TurnEngine,
  type WordLang,
} from "@kefche/game-sdk";

import bg from "../content/bg.json";
import en from "../content/en.json";

export const PACKS = ["en", "bg"] as const satisfies readonly WordLang[];
export type Pack = (typeof PACKS)[number];

export interface Config {
  pack: Pack;
  rounds: 3 | 5;
}

export function configFrom(raw: unknown): Config {
  const r = raw as { pack?: unknown; rounds?: unknown } | undefined;
  return {
    pack: PACKS.find((p) => p === r?.pack) ?? "en",
    rounds: r?.rounds === 5 ? 5 : 3,
  };
}

/** The categories' ids, the same in every pack. */
export const CATEGORIES = en.categories.map((c) => c.id);
/** Categories in a game. */
export const SLOTS = 6;
/** Letters an answer may have (spaces aside). */
export const MAX_LETTERS = 30;
/** Characters a typed answer may have as it arrives, before it's cleaned. */
export const MAX_TYPED = 60;
export const UNIQUE_POINTS = 10;
export const SHARED_POINTS = 5;

/** An answer as kept: the language's letters, folded, single spaces between words. */
export function cleanAnswer(pack: Pack, raw: string): string {
  const parts = raw
    .split(/[\s‐-―-]+/u)
    .map((part) => lettersOf(pack, part))
    .filter((part) => part.length > 0);
  let out = "";
  let letters = 0;
  for (const part of parts) {
    const chars = charsOf(part);
    if (letters + chars.length > MAX_LETTERS) break;
    out += (out ? " " : "") + part;
    letters += chars.length;
  }
  return out;
}

/** What two answers are compared by: their letters alone ("New York" is "newyork"). */
export const answerKey = (answer: string): string => answer.replaceAll(" ", "");

interface PackFile {
  letters: string[];
  categories: { id: string; answers: string[] }[];
}

/** Each category's known answers in a language, cleaned, by first letter. */
export interface Known {
  letters: readonly string[];
  /** For each category (CATEGORIES' order): first letter → answers, in the pack's order. */
  byLetter: readonly ReadonlyMap<string, readonly string[]>[];
  /** For each category: every known answer's key. */
  keys: readonly ReadonlySet<string>[];
}

function known(pack: Pack, file: PackFile): Known {
  const byLetter = CATEGORIES.map((id) => {
    const map = new Map<string, string[]>();
    const answers = file.categories.find((c) => c.id === id)?.answers ?? [];
    for (const raw of answers) {
      const answer = cleanAnswer(pack, raw);
      const first = charsOf(answer)[0];
      if (first === undefined) continue;
      const list = map.get(first) ?? [];
      if (!list.includes(answer)) list.push(answer);
      map.set(first, list);
    }
    return map;
  });
  const keys = byLetter.map(
    (map) => new Set([...map.values()].flatMap((list) => list.map(answerKey))),
  );
  return { letters: file.letters, byLetter, keys };
}

export const KNOWN: Readonly<Record<Pack, Known>> = {
  en: known("en", en),
  bg: known("bg", bg),
};

/** A letter not yet drawn, or a sheet or ballot not yet shown, in a view. */
export const HIDDEN = "";

/** An answer to vote on: whose, and in which of the game's categories. */
export interface Doubt {
  seat: number;
  slot: number;
}

/**
 * How an answer was judged: empty, the wrong first letter, a blocked word,
 * a known answer, doubtful (being voted on), or voted in or out.
 */
export type Mark = "empty" | "letter" | "blocked" | "known" | "doubt" | "in" | "out";

export interface Round {
  letter: string;
  /** Every seat's answers, by slot (a blocked one is blanked). */
  answers: string[][];
  marks: Mark[][];
  points: number[][];
  doubts: Doubt[];
  /** For each doubt, the votes to let it in and to keep it out. */
  tallies: { in: number; out: number }[];
}

export type Action = { answers: string[] } | { votes: boolean[] };

export interface State {
  players: number;
  config: Config;
  /** The game's categories, as indexes into CATEGORIES. */
  categories: number[];
  /** Each round's letter; HIDDEN for rounds not started, in a view. */
  letters: string[];
  round: number;
  phase: "answer" | "vote";
  /** Who has sent their sheet (answering) or ballot (voting) this phase. */
  sent: boolean[];
  /** This round's sheets; an empty array for one not sent or, in a view, not shown. */
  sheets: string[][];
  /** Once every sheet is in: each answer's mark. */
  marks: Mark[][];
  doubts: Doubt[];
  /** Ballots, one vote per doubt; empty until sent, and in a view until all are in. */
  votes: boolean[][];
  scores: number[];
  history: Round[];
  moves: number;
}

const over = (s: State): boolean => s.round >= s.config.rounds;

const blank = <T>(n: number): T[][] => Array.from({ length: n }, (): T[] => []);

function startRound(s: State, round: number): State {
  return {
    ...s,
    round,
    phase: "answer",
    sent: Array.from({ length: s.players }, () => false),
    sheets: blank(s.players),
    marks: blank(s.players),
    doubts: [],
    votes: blank(s.players),
  };
}

function initialState(raw: Config, seats: number, seed: string): State {
  const config = configFrom(raw);
  const rng = Rng.fromSeed(`categories:${seed}`);
  const categories = rng
    .shuffle(CATEGORIES.map((_, i) => i))
    .slice(0, SLOTS)
    .sort((a, b) => a - b);
  const letters = rng.shuffle([...KNOWN[config.pack].letters]).slice(0, config.rounds);
  const base: State = {
    players: seats,
    config,
    categories,
    letters,
    round: 0,
    phase: "answer",
    sent: [],
    sheets: [],
    marks: [],
    doubts: [],
    votes: [],
    scores: Array.from({ length: seats }, () => 0),
    history: [],
    moves: 0,
  };
  return startRound(base, 0);
}

/** Whether `seat` has anything to vote on (doubts that aren't its own). */
const votesOn = (s: State, seat: number): boolean => s.doubts.some((d) => d.seat !== seat);

function legalActions(s: State, seat: number): Action[] {
  if (over(s) || s.sent[seat] !== false) return [];
  return s.phase === "answer"
    ? [{ answers: s.categories.map(() => "") }]
    : [{ votes: s.doubts.map(() => true) }];
}

function accepts(s: State, seat: number, action: unknown): action is Action {
  if (over(s) || s.sent[seat] !== false || typeof action !== "object" || action === null) {
    return false;
  }
  if (s.phase === "answer") {
    const answers = (action as { answers?: unknown }).answers;
    return (
      Array.isArray(answers) &&
      Object.keys(action).length === 1 &&
      answers.length === s.categories.length &&
      answers.every((a) => typeof a === "string" && a.length <= MAX_TYPED)
    );
  }
  const votes = (action as { votes?: unknown }).votes;
  return (
    Array.isArray(votes) &&
    Object.keys(action).length === 1 &&
    votes.length === s.doubts.length &&
    votes.every((v) => typeof v === "boolean")
  );
}

/** Whether a cleaned answer holds a blocked word, alone or among its words. */
function blocked(pack: Pack, answer: string): boolean {
  const list = lexiconOf(pack, "blocked");
  return list.has(answerKey(answer)) || answer.split(" ").some((w) => list.has(w));
}

/** Marks every answer once all sheets are in; blocked ones are blanked. */
function check(s: State): State {
  const letter = s.letters[s.round] ?? HIDDEN;
  const { keys } = KNOWN[s.config.pack];
  const sheets: string[][] = [];
  const marks: Mark[][] = [];
  const doubts: Doubt[] = [];
  s.sheets.forEach((sheet, seat) => {
    const answers: string[] = [];
    const row: Mark[] = [];
    s.categories.forEach((category, slot) => {
      const answer = sheet[slot] ?? "";
      let mark: Mark;
      if (answer === "") mark = "empty";
      else if (charsOf(answer)[0] !== letter) mark = "letter";
      else if (blocked(s.config.pack, answer)) mark = "blocked";
      else if (keys[category]?.has(answerKey(answer))) mark = "known";
      else {
        mark = "doubt";
        doubts.push({ seat, slot });
      }
      answers.push(mark === "blocked" ? "" : answer);
      row.push(mark);
    });
    sheets.push(answers);
    marks.push(row);
  });
  return { ...s, sheets, marks, doubts };
}

/** Scores the round (its doubts decided) and starts the next. */
function finishRound(s: State, tallies: Round["tallies"]): State {
  const marks = s.marks.map((row) => [...row]);
  s.doubts.forEach((d, i) => {
    const t = tallies[i] ?? { in: 0, out: 0 };
    const row = marks[d.seat];
    if (row) row[d.slot] = t.out > t.in ? "out" : "in";
  });
  const counts = s.categories.map((_, slot) => {
    const seen = new Map<string, number>();
    marks.forEach((row, seat) => {
      if (row[slot] !== "known" && row[slot] !== "in") return;
      const key = answerKey(s.sheets[seat]?.[slot] ?? "");
      seen.set(key, (seen.get(key) ?? 0) + 1);
    });
    return seen;
  });
  const points: number[][] = marks.map((row, seat) =>
    row.map((mark, slot) => {
      if (mark !== "known" && mark !== "in") return 0;
      const key = answerKey(s.sheets[seat]?.[slot] ?? "");
      return (counts[slot]?.get(key) ?? 0) > 1 ? SHARED_POINTS : UNIQUE_POINTS;
    }),
  );
  const done: Round = {
    letter: s.letters[s.round] ?? HIDDEN,
    answers: s.sheets,
    marks,
    points,
    doubts: s.doubts,
    tallies,
  };
  return startRound(
    {
      ...s,
      scores: s.scores.map((v, seat) => v + (points[seat] ?? []).reduce((a, b) => a + b, 0)),
      history: [...s.history, done],
    },
    s.round + 1,
  );
}

function tally(s: State, votes: readonly boolean[][]): Round["tallies"] {
  return s.doubts.map((d, i) => {
    const t = { in: 0, out: 0 };
    votes.forEach((ballot, seat) => {
      if (seat === d.seat || ballot[i] === undefined) return;
      if (ballot[i]) t.in++;
      else t.out++;
    });
    return t;
  });
}

function applyAction(s: State, seat: number, action: Action): State {
  if (!accepts(s, seat, action)) return s;
  const sent = s.sent.map((v, i) => v || i === seat);
  const moved = { ...s, sent, moves: s.moves + 1 };
  if ("answers" in action) {
    const pack = s.config.pack;
    const sheet = action.answers.map((a) => cleanAnswer(pack, a));
    const next = { ...moved, sheets: s.sheets.map((v, i) => (i === seat ? sheet : v)) };
    if (sent.some((v) => !v)) return next;
    const checked = check(next);
    const voters = checked.sent.map((_, i) => votesOn(checked, i));
    // Nothing to vote on, or nobody to vote: every doubt counts.
    if (!voters.some(Boolean)) return finishRound(checked, tally(checked, checked.votes));
    return { ...checked, phase: "vote", sent: voters.map((v) => !v) };
  }
  if (!("votes" in action)) return s;
  const votes = s.votes.map((v, i) => (i === seat ? [...action.votes] : v));
  const next = { ...moved, votes };
  if (sent.some((v) => !v)) return next;
  return finishRound(next, tally(next, votes));
}

function currentSeats(s: State): number[] {
  if (over(s)) return [];
  return s.sent.flatMap((v, seat) => (v ? [] : [seat]));
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

/**
 * Other seats' sheets stay hidden until every sheet is in, and their
 * ballots until every ballot is in; letters still to come are hidden.
 */
function view(s: State, seat: number | null): State {
  if (over(s)) return s;
  return {
    ...s,
    letters: s.letters.map((l, i) => (i <= s.round ? l : HIDDEN)),
    sheets: s.phase === "answer" ? s.sheets.map((v, i) => (i === seat ? v : [])) : s.sheets,
    votes: s.votes.map((v, i) => (i === seat ? v : [])),
  };
}

/** A sheet or ballot is its sender's own until the round shows them all. */
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
