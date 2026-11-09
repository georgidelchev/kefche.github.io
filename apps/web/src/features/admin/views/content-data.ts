// The Content section's data (Phase 10 step 8): announcements
// (staff_announcements, staff_save_announcement, staff_remove_announcement),
// the daily challenge's schedule (staff_daily_schedule, staff_set_daily) and
// the Word of the Day (staff_words, staff_set_word). Every change is audited.
// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import { LOCALES, type Locale } from "@/i18n/locales";
import type { Supabase } from "@/lib/supabase/client";

const text = z.nullable(z.string());
const Announcement = z.object({
  id: z.string(),
  texts: z.record(z.string(), z.string()),
  url: text,
  audience: z.enum(["everyone", "language", "staff"]),
  locale: text,
  send_at: z.string(),
  ticker: z.boolean(),
  ticker_until: text,
  sent_at: text,
  recipients: z.nullable(z.number()),
});
export type Announcement = z.infer<typeof Announcement>;
export type Audience = Announcement["audience"];

const done = ({ error }: { error: { message: string } | null }) => (error ? error.message : null);

export async function fetchAnnouncements(supabase: Supabase): Promise<Announcement[] | null> {
  const { data, error } = await supabase.rpc("staff_announcements");
  if (error) return null;
  const rows = z.array(Announcement).safeParse(data);
  return rows.success ? rows.data : null;
}

export interface AnnouncementDraft {
  id: string | null;
  texts: Partial<Record<Locale, string>>;
  url: string;
  audience: Audience;
  locale: Locale;
  /** A `datetime-local` value in the admin's time, or "" for now. */
  sendAt: string;
  ticker: boolean;
  /** A `datetime-local` value, or "" for no end. */
  tickerUntil: string;
}

export const emptyDraft = (): AnnouncementDraft => ({
  id: null,
  texts: {},
  url: "",
  audience: "everyone",
  locale: "en",
  sendAt: "",
  ticker: false,
  tickerUntil: "",
});

/** A `datetime-local` value (the admin's time) as ISO, or null when empty. */
export const localToIso = (value: string) => (value === "" ? null : new Date(value).toISOString());

/** ISO as a `datetime-local` value in the admin's time. */
export function isoToLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const draftOf = (a: Announcement): AnnouncementDraft => ({
  id: a.id,
  texts: Object.fromEntries(
    Object.entries(a.texts).filter(([locale]) => (LOCALES as readonly string[]).includes(locale)),
  ),
  url: a.url ?? "",
  audience: a.audience,
  locale: (LOCALES as readonly string[]).includes(a.locale ?? "") ? (a.locale as Locale) : "en",
  sendAt: isoToLocal(a.send_at),
  ticker: a.ticker,
  tickerUntil: a.ticker_until ? isoToLocal(a.ticker_until) : "",
});

/** Whether a draft would go out at once (no time, or one already past). */
export const sendsNow = (draft: AnnouncementDraft, now = Date.now()) =>
  draft.sendAt === "" || new Date(draft.sendAt).getTime() <= now;

export async function saveAnnouncement(
  supabase: Supabase,
  draft: AnnouncementDraft,
): Promise<string | null> {
  const texts = Object.fromEntries(
    Object.entries(draft.texts).filter(([, value]) => value.trim() !== ""),
  );
  const sendAt = sendsNow(draft) ? null : localToIso(draft.sendAt);
  const until = draft.ticker ? localToIso(draft.tickerUntil) : null;
  return done(
    await supabase.rpc("staff_save_announcement", {
      ...(draft.id ? { p_id: draft.id } : {}),
      p_texts: texts,
      ...(draft.url.trim() ? { p_url: draft.url.trim() } : {}),
      p_audience: draft.audience,
      ...(draft.audience === "language" ? { p_locale: draft.locale } : {}),
      ...(sendAt ? { p_send_at: sendAt } : {}),
      p_ticker: draft.ticker,
      ...(until ? { p_ticker_until: until } : {}),
    }),
  );
}

export const removeAnnouncement = async (supabase: Supabase, id: string) =>
  done(await supabase.rpc("staff_remove_announcement", { p_id: id }));

const Config = z.record(z.string(), z.unknown());
const Day = z.object({
  day: z.string(),
  gameId: z.string(),
  config: Config,
  made: z.boolean(),
  chosen: z.boolean(),
});
export type Day = z.infer<typeof Day>;
const Choice = z.object({ position: z.number(), gameId: z.string(), config: Config });
export type Choice = z.infer<typeof Choice>;
const Schedule = z.object({ days: z.array(Day), choices: z.array(Choice) });
export type Schedule = z.infer<typeof Schedule>;

export async function fetchSchedule(supabase: Supabase): Promise<Schedule | null> {
  const { data, error } = await supabase.rpc("staff_daily_schedule");
  if (error) return null;
  const schedule = Schedule.safeParse(data);
  return schedule.success ? schedule.data : null;
}

/** Sets a future day to a rotation choice, or back to the rotation (null). */
export const setDaily = async (supabase: Supabase, day: string, position: number | null) =>
  done(
    await supabase.rpc("staff_set_daily", {
      p_day: day,
      ...(position === null ? {} : { p_position: position }),
    }),
  );

/** A day's settings in words: "speed: normal · walls: true". */
export const configText = (config: Record<string, unknown>) =>
  Object.entries(config)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");

const Word = z.object({
  locale: z.string(),
  day: z.string(),
  word: z.string(),
  meaning: text,
});
export type Word = z.infer<typeof Word>;

export async function fetchWords(supabase: Supabase): Promise<Word[] | null> {
  const { data, error } = await supabase.rpc("staff_words");
  if (error) return null;
  const rows = z.array(Word).safeParse(data);
  return rows.success ? rows.data : null;
}

/** Sets a word (or removes it, with an empty word). */
export const setWord = async (
  supabase: Supabase,
  locale: string,
  day: string,
  word: string,
  meaning: string,
) =>
  done(
    await supabase.rpc("staff_set_word", {
      p_locale: locale,
      p_day: day,
      ...(word.trim() ? { p_word: word.trim() } : {}),
      ...(meaning.trim() ? { p_meaning: meaning.trim() } : {}),
    }),
  );

/** Today in UTC, as YYYY-MM-DD (days run on UTC). */
export const todayUtc = (now = new Date()) => now.toISOString().slice(0, 10);

/** A YYYY-MM-DD day in the page's language. */
export const dayText = (day: string, bcp47: string) =>
  new Intl.DateTimeFormat(bcp47, { dateStyle: "full", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
