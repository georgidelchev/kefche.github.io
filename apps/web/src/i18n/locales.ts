/**
 * The supported UI locales (SPEC §5). Single source of truth for routing,
 * fonts, text direction and `hreflang`. The URL segment is the short code;
 * `bcp47` is what goes into `<html lang>` and `hreflang`.
 */
export const LOCALES = ["en", "es", "pt", "fr", "de", "ru", "zh", "hi", "ar", "ja", "bg"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE = "en" satisfies Locale;

/** Writing system; selects font faces (components/Fonts.astro) and stacks (typography.css). */
export type Script = "latin" | "cyrillic" | "arabic" | "devanagari" | "cjk";

export interface LocaleInfo {
  /** Name in its own script, as shown in the language switcher. */
  nativeName: string;
  bcp47: string;
  dir: "ltr" | "rtl";
  script: Script;
  /** Open Graph `og:locale` (language_TERRITORY). */
  ogLocale: string;
}

export const LOCALE_INFO: Record<Locale, LocaleInfo> = {
  en: { nativeName: "English", bcp47: "en", dir: "ltr", script: "latin", ogLocale: "en_US" },
  es: { nativeName: "Español", bcp47: "es", dir: "ltr", script: "latin", ogLocale: "es_ES" },
  pt: { nativeName: "Português", bcp47: "pt", dir: "ltr", script: "latin", ogLocale: "pt_BR" },
  fr: { nativeName: "Français", bcp47: "fr", dir: "ltr", script: "latin", ogLocale: "fr_FR" },
  de: { nativeName: "Deutsch", bcp47: "de", dir: "ltr", script: "latin", ogLocale: "de_DE" },
  ru: { nativeName: "Русский", bcp47: "ru", dir: "ltr", script: "cyrillic", ogLocale: "ru_RU" },
  zh: { nativeName: "简体中文", bcp47: "zh-Hans", dir: "ltr", script: "cjk", ogLocale: "zh_CN" },
  hi: { nativeName: "हिन्दी", bcp47: "hi", dir: "ltr", script: "devanagari", ogLocale: "hi_IN" },
  ar: { nativeName: "العربية", bcp47: "ar", dir: "rtl", script: "arabic", ogLocale: "ar_AR" },
  ja: { nativeName: "日本語", bcp47: "ja", dir: "ltr", script: "cjk", ogLocale: "ja_JP" },
  bg: { nativeName: "Български", bcp47: "bg", dir: "ltr", script: "cyrillic", ogLocale: "bg_BG" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
