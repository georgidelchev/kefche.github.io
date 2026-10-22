// Server-side helpers for the pages in src/pages/[locale]/auth/.
import { LOCALE_INFO, LOCALES, type Locale } from "@/i18n/locales";
import { getSupabaseEnv } from "@/lib/env";

import type { GetStaticPaths } from "astro";

/** One page per locale, or none in builds without Supabase (ADR-0011). */
export const authStaticPaths = (() =>
  getSupabaseEnv()
    ? LOCALES.map((locale) => ({ params: { locale } }))
    : []) satisfies GetStaticPaths;

/** Month names in the page's language, January first (standalone form). */
export function monthNames(locale: Locale): string[] {
  const format = new Intl.DateTimeFormat(LOCALE_INFO[locale].bcp47, {
    month: "long",
    timeZone: "UTC",
  });
  return Array.from({ length: 12 }, (_, i) => format.format(new Date(Date.UTC(2000, i, 15))));
}
