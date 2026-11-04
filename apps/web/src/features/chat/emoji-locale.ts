// The emoji picker's language (Emojibase locales): the page's where
// Emojibase has it, English otherwise (Arabic and Bulgarian, for now).
import type { Locale } from "@/i18n/locales";

export const EMOJI_DATA_LOCALES = ["en", "es", "pt", "fr", "de", "ru", "zh", "hi", "ja"] as const;
export type EmojiLocale = (typeof EMOJI_DATA_LOCALES)[number];

export const emojiLocale = (locale: Locale): EmojiLocale =>
  (EMOJI_DATA_LOCALES as readonly string[]).includes(locale) ? (locale as EmojiLocale) : "en";
