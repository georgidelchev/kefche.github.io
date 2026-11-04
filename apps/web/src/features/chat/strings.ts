import type { AppT } from "@/i18n/i18n";
import type { Locale } from "@/i18n/locales";

import { emojiLocale } from "./emoji-locale";

/** The emoji and GIF pickers of every chat. */
export function chatToolsStrings(t: AppT, locale: Locale) {
  return {
    emoji: t("chat:tools.emoji"),
    emojiSearch: t("chat:tools.emojiSearch"),
    emojiEmpty: t("chat:tools.emojiEmpty"),
    loading: t("chat:tools.loading"),
    gif: t("chat:tools.gif"),
    gifSearch: t("chat:tools.gifSearch"),
    gifEmpty: t("chat:tools.gifEmpty"),
    gifFailed: t("chat:tools.gifFailed"),
    gifBusy: t("chat:tools.gifBusy"),
    gifMore: t("chat:tools.gifMore"),
    gifAlt: t("chat:tools.gifAlt"),
    gifInvalid: t("chat:tools.gifInvalid"),
    gifPowered: t("chat:tools.gifPowered"),
    close: t("chat:actions.close"),
    /** The picker data's language (Emojibase), and the page's for GIF searches. */
    emojiLocale: emojiLocale(locale),
    locale,
  };
}
export type ChatToolsStrings = ReturnType<typeof chatToolsStrings>;

/** The chat page's strings, translated on the server; placeholders are filled in on the client. */
export function chatPageStrings(t: AppT) {
  return {
    title: t("chat:title"),
    room: t("chat:room"),
    label: t("chat:label"),
    send: t("chat:send"),
    empty: t("chat:empty"),
    loading: t("chat:loading"),
    failed: t("chat:failed"),
    retry: t("chat:retry"),
    earlier: t("chat:earlier"),
    slowMode: t("chat:slowMode", { seconds: "{seconds}" }),
    errors: {
      tooFast: t("chat:errors.tooFast"),
      tooLong: t("chat:errors.tooLong"),
      tooNewUntil: t("chat:errors.tooNewUntil", { until: "{until}" }),
      slowUntil: t("chat:errors.slowUntil", { until: "{until}" }),
      mutedUntil: t("chat:errors.mutedUntil", { until: "{until}" }),
      muted: t("chat:errors.muted"),
      failed: t("chat:errors.failed"),
    },
    actions: {
      delete: t("chat:actions.delete"),
      mute: t("chat:actions.mute", { name: "{name}" }),
      muteTitle: t("chat:actions.muteTitle", { name: "{name}" }),
      duration: t("chat:actions.duration"),
      reason: t("chat:actions.reason"),
      submit: t("chat:actions.submit"),
      cancel: t("chat:actions.cancel"),
      close: t("chat:actions.close"),
      muted: t("chat:actions.muted", { name: "{name}" }),
      durations: {
        m10: t("chat:actions.durations.m10"),
        h1: t("chat:actions.durations.h1"),
        h24: t("chat:actions.durations.h24"),
        d7: t("chat:actions.durations.d7"),
      },
    },
    // A moderator's reasons for a mute, as notifications word them.
    reasons: {
      spam: t("notifications:reasons.spam"),
      harassment: t("notifications:reasons.harassment"),
      hate: t("notifications:reasons.hate"),
      sexual: t("notifications:reasons.sexual"),
      selfHarm: t("notifications:reasons.selfHarm"),
      other: t("notifications:reasons.other"),
    },
  };
}
export type ChatPageStrings = ReturnType<typeof chatPageStrings>;
