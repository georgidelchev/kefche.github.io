// The admin panel's translation report (SPEC §14, Phase 10 step 9), built at
// build time from the locale files: per language, the keys English has that
// it lacks (none while `pnpm i18n:check` passes) and the strings still the
// same as English (often not translated yet, sometimes rightly the same, as
// with "GIF"). The site's namespaces and each game's text are both covered.
// Server and build time only: the page serves it as a static JSON file.
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/locales";

const siteFiles = import.meta.glob<Record<string, unknown>>("../../../locales/*/*.json", {
  eager: true,
  import: "default",
});
const gameFiles = import.meta.glob<Record<string, unknown>>(
  "../../../../../packages/games/*/i18n/*.json",
  { eager: true, import: "default" },
);

/** Every string leaf as "path": value (array items by index). */
function flatten(value: unknown, prefix: string, out: Map<string, string>): Map<string, string> {
  if (typeof value === "string") out.set(prefix, value);
  else if (value && typeof value === "object")
    for (const [key, child] of Object.entries(value))
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
  return out;
}

/** Each locale's strings as "<group>:<key>": the site's namespaces, and "game/<id>" for games. */
function stringsByLocale(): Map<string, Map<string, string>> {
  const byLocale = new Map<string, Map<string, string>>();
  const add = (locale: string, group: string, json: unknown) => {
    const strings = byLocale.get(locale) ?? new Map<string, string>();
    for (const [key, text] of flatten(json, "", new Map())) strings.set(`${group}:${key}`, text);
    byLocale.set(locale, strings);
  };
  for (const [path, json] of Object.entries(siteFiles)) {
    const [, locale = "", ns = ""] = /\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path) ?? [];
    add(locale, ns, json);
  }
  for (const [path, json] of Object.entries(gameFiles)) {
    const [, game = "", locale = ""] = /\/games\/([^/]+)\/i18n\/([^/]+)\.json$/.exec(path) ?? [];
    add(locale, `game/${game}`, json);
  }
  return byLocale;
}

export interface LocaleReport {
  locale: Locale;
  /** How many strings English has. */
  total: number;
  /** Keys English has that this locale lacks. */
  missing: string[];
  /** Strings with letters that read exactly as in English: [key, text]. */
  same: [string, string][];
}

/** The report for every locale but English, in the site's order. */
export function i18nReport(): LocaleReport[] {
  const byLocale = stringsByLocale();
  const english = byLocale.get(DEFAULT_LOCALE) ?? new Map<string, string>();
  return LOCALES.filter((locale) => locale !== DEFAULT_LOCALE).map((locale) => {
    const strings = byLocale.get(locale) ?? new Map<string, string>();
    const missing: string[] = [];
    const same: [string, string][] = [];
    for (const [key, text] of english) {
      const own = strings.get(key);
      if (own === undefined) missing.push(key);
      // Placeholders and punctuation alone ("{count}", "·") aren't words to translate.
      else if (own === text && /\p{L}/u.test(text.replace(/\{[^}]*\}/g, "")))
        same.push([key, text]);
    }
    return { locale, total: english.size, missing, same };
  });
}
