import type { AppT } from "@/i18n/i18n";

/** The report dialog's strings; placeholders are filled in on the client. */
export function reportStrings(t: AppT) {
  return {
    action: t("common:report.action"),
    message: t("common:report.message"),
    /** "Report {name}'s message" */
    titleMessage: t("common:report.titleMessage", { name: "{name}" }),
    /** "Report {name}" */
    titlePlayer: t("common:report.titlePlayer", { name: "{name}" }),
    what: t("common:report.what"),
    whatProfile: t("common:report.whatProfile"),
    whatAvatar: t("common:report.whatAvatar"),
    reason: t("common:report.reason"),
    reasons: {
      spam: t("common:report.reasons.spam"),
      harassment: t("common:report.reasons.harassment"),
      hate: t("common:report.reasons.hate"),
      sexual: t("common:report.reasons.sexual"),
      selfHarm: t("common:report.reasons.selfHarm"),
      cheating: t("common:report.reasons.cheating"),
      other: t("common:report.reasons.other"),
    },
    details: t("common:report.details"),
    hint: t("common:report.hint"),
    guidelines: t("legal:guidelines.title"),
    submit: t("common:report.submit"),
    cancel: t("common:report.cancel"),
    close: t("common:report.close"),
    outcomes: {
      sent: t("common:report.sent"),
      already: t("common:report.already"),
      rateLimited: t("common:report.rateLimited"),
      gone: t("common:report.gone"),
      failed: t("common:report.failed"),
    },
    /** Under a player's own message that reports hid. */
    hidden: t("common:report.hidden"),
  };
}
export type ReportStrings = ReturnType<typeof reportStrings>;

/** A moderator's mute, from a chat; placeholders are filled in on the client. */
export function muteStrings(t: AppT) {
  return {
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
export type MuteStrings = ReturnType<typeof muteStrings>;
