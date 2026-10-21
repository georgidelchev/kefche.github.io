import i18next, { type TFunction } from "i18next";
import ICU from "i18next-icu";

import { isLocale, type Locale } from "./locales";

/** UI namespaces (SPEC §5). Add one here and in `locales/<locale>/<ns>.json` for every locale. */
export const NAMESPACES = ["common", "nav"] as const;
export type Namespace = (typeof NAMESPACES)[number];

type Resources = Partial<Record<Namespace, Record<string, unknown>>>;

// All UI translations are bundled at build time and used during server
// rendering only; React islands receive already-translated strings as props,
// so i18next never ships to the browser for content pages (ADR-0009).
const files = import.meta.glob<Record<string, unknown>>("../../locales/*/*.json", {
  eager: true,
  import: "default",
});

const resourcesByLocale = new Map<Locale, Resources>();
for (const [path, messages] of Object.entries(files)) {
  const match = /\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
  const [, locale, ns] = match ?? [];
  if (!isLocale(locale) || !(NAMESPACES as readonly string[]).includes(ns ?? "")) continue;
  resourcesByLocale.set(locale, { ...resourcesByLocale.get(locale), [ns as Namespace]: messages });
}

/** Bound to all namespaces, so keys are typed as `"<namespace>:<key>"`. */
export type AppT = TFunction<typeof NAMESPACES>;

const cache = new Map<Locale, AppT>();

/**
 * Translation function for `locale`. Keys are always written in full as
 * `"<namespace>:<key>"` (pnpm i18n:check relies on it to detect unused keys).
 * There is no fallback language: a missing key fails `i18n:check` instead.
 */
export function getT(locale: Locale): AppT {
  const cached = cache.get(locale);
  if (cached) return cached;

  const instance = i18next.createInstance();
  void instance.use(ICU).init({
    lng: locale,
    fallbackLng: false,
    ns: NAMESPACES,
    defaultNS: "common",
    resources: { [locale]: resourcesByLocale.get(locale) ?? {} },
    initAsync: false,
    // Astro and React escape output themselves.
    interpolation: { escapeValue: false },
  });
  const t = instance.getFixedT(locale, NAMESPACES);
  cache.set(locale, t);
  return t;
}
