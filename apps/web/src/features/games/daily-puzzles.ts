// Daily puzzles' server side (context.daily, Phase 13): Word of the Day's
// word for each language (`word_of_the_day`, public, without loading
// supabase-js), and an account's streak (`finish_daily_word`,
// `daily_streak`). Never rejects: anything that goes wrong is null.
// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import type { DailyAccess, DailyStreak } from "@kefche/game-sdk/browser";

import { getSupabase } from "@/lib/supabase/client";
import { supabaseConfig } from "@/lib/supabase/config";

import { isAccount } from "./plays";

const streakSchema = z.object({
  current: z.number(),
  best: z.number(),
  played: z.number(),
  won: z.number(),
  spread: z.array(z.number()),
  lastDay: z.nullable(z.string()),
});

const wordSchema = z.object({
  day: z.string(),
  word: z.string().check(z.minLength(1), z.maxLength(40)),
  meaning: z.nullable(z.string().check(z.maxLength(300))),
});

const streakOf = (data: unknown): DailyStreak | null => {
  const parsed = streakSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
};

/** Today's word in a language, read with the publishable key. */
async function todaysWord(lang: string): Promise<{ day: string; data: unknown } | null> {
  if (!supabaseConfig) return null;
  const res = await fetch(new URL("/rest/v1/rpc/word_of_the_day", supabaseConfig.url), {
    method: "POST",
    headers: { apikey: supabaseConfig.key, "content-type": "application/json" },
    body: JSON.stringify({ p_locale: lang }),
  }).catch(() => null);
  if (!res?.ok) return null;
  const word = wordSchema.safeParse(await res.json().catch(() => null));
  return word.success
    ? { day: word.data.day, data: { word: word.data.word, meaning: word.data.meaning } }
    : null;
}

/** Calls a streak RPC for an account; null for a guest or on any failure. */
async function streakCall(
  call: (
    supabase: NonNullable<Awaited<ReturnType<typeof getSupabase>>>,
  ) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<DailyStreak | null> {
  if (!isAccount()) return null;
  try {
    const supabase = await getSupabase();
    if (!supabase) return null;
    const { data, error } = await call(supabase);
    return error ? null : streakOf(data);
  } catch {
    return null;
  }
}

const wordOfTheDay: DailyAccess = {
  today: todaysWord,
  finish: (lang, answer) => {
    const guesses = z.array(z.string().check(z.maxLength(5))).safeParse(answer);
    if (!guesses.success) return Promise.resolve(null);
    return streakCall((supabase) =>
      supabase.rpc("finish_daily_word", { p_locale: lang, p_guesses: guesses.data }),
    );
  },
  streak: (lang) =>
    streakCall((supabase) =>
      supabase.rpc("daily_streak", { p_game: "word-of-the-day", p_locale: lang }),
    ),
};

/** The daily side of a game that has one. */
export const dailyAccess = (gameId: string): DailyAccess | undefined =>
  gameId === "word-of-the-day" ? wordOfTheDay : undefined;
