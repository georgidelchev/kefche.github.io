import type { Locale } from "@/i18n/locales";

/** Localized URLs the auth islands and scripts navigate to. */
export interface AuthPaths {
  home: string;
  signIn: string;
  signUp: string;
  forgot: string;
  reset: string;
  callback: string;
  onboarding: string;
  merge: string;
  settings: string;
}

/** Built on the server (Astro's i18n helpers) and passed to islands as props. */
export function authPaths(
  locale: Locale,
  localeUrl: (locale: Locale, path: string) => string,
): AuthPaths {
  return {
    home: localeUrl(locale, "/"),
    signIn: localeUrl(locale, "/auth/sign-in/"),
    signUp: localeUrl(locale, "/auth/sign-up/"),
    forgot: localeUrl(locale, "/auth/forgot-password/"),
    reset: localeUrl(locale, "/auth/reset-password/"),
    callback: localeUrl(locale, "/auth/callback/"),
    onboarding: localeUrl(locale, "/auth/onboarding/"),
    merge: localeUrl(locale, "/auth/merge/"),
    settings: localeUrl(locale, "/settings/"),
  };
}
