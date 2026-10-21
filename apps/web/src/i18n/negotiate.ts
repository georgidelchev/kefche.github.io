import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "./locales";

/** Cookie holding an explicit language choice (necessary category: language preference, SPEC §17). */
export const LOCALE_COOKIE = "kefche_locale";
/** Same value for client-side use (SPEC §5: guests → cookie + localStorage). */
export const LOCALE_STORAGE_KEY = "kefche:locale";

interface WeightedTag {
  tag: string;
  q: number;
}

/** Parses an Accept-Language header into tags ordered by preference (q=0 and malformed entries dropped). */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  const tags: WeightedTag[] = [];
  for (const part of header.slice(0, 1000).split(",")) {
    const [rawTag, ...params] = part.trim().split(";");
    const tag = rawTag?.trim().toLowerCase() ?? "";
    if (!/^[a-z]{1,8}(-[a-z0-9]{1,8})*$/.test(tag)) continue;
    const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    const q = qParam ? Number(qParam.slice(2)) : 1;
    if (!Number.isFinite(q) || q <= 0 || q > 1) continue;
    tags.push({ tag, q });
  }
  // Stable sort keeps header order for equal weights.
  return tags.sort((a, b) => b.q - a.q).map((t) => t.tag);
}

/** Maps a language tag to a supported locale by its primary subtag (zh-TW → zh, pt-PT → pt). */
export function matchLocale(tag: string): Locale | undefined {
  const primary = tag.split("-")[0];
  return LOCALES.find((l) => l === primary);
}

/** SPEC §5: saved preference → Accept-Language → default. */
export function negotiateLocale(input: {
  saved?: string | null | undefined;
  acceptLanguage?: string | null | undefined;
}): Locale {
  if (isLocale(input.saved)) return input.saved;
  for (const tag of parseAcceptLanguage(input.acceptLanguage)) {
    const match = matchLocale(tag);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}
