// Remembers the preferred language for `/` and future visits (SPEC §5): a
// cookie the Worker reads, plus localStorage. Shared by the language switcher,
// the settings page and account sync.
import { isLocale, type Locale } from "@/i18n/locales";
import { LOCALE_COOKIE, LOCALE_STORAGE_KEY } from "@/i18n/negotiate";

/** Dispatched on `document` when the user picks a language (detail: Locale). */
export const LOCALE_CHANGE_EVENT = "kefche:localechange";

const ONE_YEAR = 60 * 60 * 24 * 365;

export function storedLocale(): Locale | null {
  try {
    const value = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Stores `locale`. `announce` marks a user's own choice, which account sync
 * saves to their profile; values loaded from the profile don't.
 */
export function rememberLocale(locale: Locale, { announce }: { announce: boolean }): void {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${String(ONE_YEAR)}; SameSite=Lax${secure}`;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The cookie alone is enough.
  }
  if (announce) document.dispatchEvent(new CustomEvent(LOCALE_CHANGE_EVENT, { detail: locale }));
}

/** `path` with its leading locale segment replaced (e.g. /en/u/x/ → /bg/u/x/). */
export function localizePath(path: string, locale: Locale): string {
  const [, first, ...rest] = path.split("/");
  return isLocale(first) ? ["", locale, ...rest].join("/") : path;
}
