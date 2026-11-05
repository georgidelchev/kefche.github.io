// Generated with push-words.gen.js: do not edit. Used by push-text.ts.
export interface PushNotification {
  id: number;
  type: string;
  data: Record<string, unknown>;
  at: string;
  from: { id: string; nickname: string } | null;
}
export interface LocaleWords {
  strings: unknown;
  games: Record<string, string>;
  achievements: Record<string, string>;
  paths: Record<
    "friends" | "profileBase" | "play" | "profile" | "leaderboards" | "messages" | "notifications",
    string
  >;
}
export declare const WORDS: Readonly<Record<string, LocaleWords>>;
export declare const LOCALE_INFO: Readonly<Record<string, { bcp47: string; dir: "ltr" | "rtl" }>>;
export declare function notificationText(
  n: PushNotification,
  s: unknown,
  c: { games: Record<string, string>; achievements: Record<string, string>; locale: string; bcp47: string },
): string | null;
export declare function notificationHref(n: PushNotification, p: LocaleWords["paths"]): string | null;
