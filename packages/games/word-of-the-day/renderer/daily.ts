// Word of the Day's records on this device, and what's shared. Pure, but
// for reading and writing the game's own storage.
// - Each day's game in each language, as it goes (its guesses), so leaving
//   the page doesn't give six fresh tries, and a finished day isn't played
//   again.
// - A guest's streak, kept the way the server keeps an account's
//   (finish_daily_word): days in a row solved, games played and won, and
//   the wins by tries.
import type { DailyStreak, GameStorage } from "@kefche/game-sdk/browser";

import { TRIES, type Mark, type Pack } from "../engine";

export interface SavedDay {
  guesses: string[];
  over: boolean;
}

const dayKey = (pack: Pack, day: string) => `day:${pack}:${day}`;
const streakKey = (pack: Pack) => `streak:${pack}`;

const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length <= TRIES && v.every((s) => typeof s === "string");

export function readDay(storage: GameStorage, pack: Pack, day: string): SavedDay | null {
  try {
    const raw = JSON.parse(storage.get(dayKey(pack, day)) ?? "null") as Partial<SavedDay> | null;
    return raw && strings(raw.guesses) ? { guesses: raw.guesses, over: raw.over === true } : null;
  } catch {
    return null;
  }
}

export function saveDay(storage: GameStorage, pack: Pack, day: string, saved: SavedDay): void {
  storage.set(dayKey(pack, day), JSON.stringify(saved));
}

/** A guest's streak, with the day they last solved one. */
interface LocalStreak extends DailyStreak {
  lastWon: string | null;
}

const EMPTY: LocalStreak = {
  current: 0,
  best: 0,
  played: 0,
  won: 0,
  spread: Array.from({ length: TRIES }, () => 0),
  lastDay: null,
  lastWon: null,
};

/** The UTC day before `day` (YYYY-MM-DD). */
export const dayBefore = (day: string): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

function readLocal(storage: GameStorage, pack: Pack): LocalStreak {
  try {
    const raw = JSON.parse(storage.get(streakKey(pack)) ?? "null") as Partial<LocalStreak> | null;
    if (!raw) return EMPTY;
    const n = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : 0);
    const day = (v: unknown) => (typeof v === "string" ? v : null);
    const spread = Array.isArray(raw.spread) ? raw.spread : [];
    return {
      current: n(raw.current),
      best: n(raw.best),
      played: n(raw.played),
      won: n(raw.won),
      spread: Array.from({ length: TRIES }, (_, i) => n(spread[i])),
      lastDay: day(raw.lastDay),
      lastWon: day(raw.lastWon),
    };
  } catch {
    return EMPTY;
  }
}

/** A streak as it stands on `today`: one not carried on since yesterday has ended. */
const shown = (s: LocalStreak, today: string): DailyStreak => ({
  current: s.lastWon === today || s.lastWon === dayBefore(today) ? s.current : 0,
  best: s.best,
  played: s.played,
  won: s.won,
  spread: s.spread,
  lastDay: s.lastDay,
});

export const localStreak = (storage: GameStorage, pack: Pack, today: string): DailyStreak =>
  shown(readLocal(storage, pack), today);

/** Records a guest's finished day (once a day); the streak after it. */
export function recordLocal(
  storage: GameStorage,
  pack: Pack,
  day: string,
  won: boolean,
  tries: number,
): DailyStreak {
  const s = readLocal(storage, pack);
  if (s.lastDay === day) return shown(s, day);
  const carried = s.lastWon === dayBefore(day);
  const current = won ? (carried ? s.current + 1 : 1) : 0;
  const next: LocalStreak = {
    current,
    best: Math.max(s.best, current),
    played: s.played + 1,
    won: s.won + (won ? 1 : 0),
    spread: s.spread.map((v, i) => (won && i === tries - 1 ? v + 1 : v)),
    lastDay: day,
    lastWon: won ? day : s.lastWon,
  };
  storage.set(streakKey(pack), JSON.stringify(next));
  return shown(next, day);
}

/** Today's UTC day, YYYY-MM-DD. */
export const utcToday = (now = Date.now()): string => new Date(now).toISOString().slice(0, 10);

/** Milliseconds until the next UTC midnight, when the word changes. */
export function untilNextWord(now = Date.now()): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now;
}

const SQUARE: Record<Mark, string> = { good: "🟩", near: "🟨", miss: "⬛" };

/** The shared grid: the marks only, never the letters. */
export const shareGrid = (marks: readonly (readonly Mark[])[]): string =>
  marks.map((row) => row.map((m) => SQUARE[m]).join("")).join("\n");
