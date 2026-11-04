import type { AppT } from "@/i18n/i18n";

/** The messages page's strings, translated on the server; placeholders are filled in on the client. */
export function messagesPageStrings(t: AppT) {
  return {
    conversations: t("messages:conversations"),
    empty: t("messages:empty"),
    emptyHint: t("messages:emptyHint"),
    pick: t("messages:pick"),
    back: t("messages:back"),
    label: t("messages:label"),
    send: t("messages:send"),
    earlier: t("messages:earlier"),
    loading: t("messages:loading"),
    failed: t("messages:failed"),
    retry: t("messages:retry"),
    typing: t("messages:typing", { name: "{name}" }),
    seen: t("messages:seen"),
    deleted: t("messages:deleted"),
    delete: t("messages:delete"),
    you: t("messages:you", { text: "{text}" }),
    unread: t("messages:unread", { count: "{count}" }),
    start: t("messages:start", { name: "{name}" }),
    cantWrite: t("messages:cantWrite"),
    errors: {
      unavailable: t("messages:errors.unavailable"),
      tooNewUntil: t("messages:errors.tooNewUntil", { until: "{until}" }),
      mutedUntil: t("messages:errors.mutedUntil", { until: "{until}" }),
      muted: t("messages:errors.muted"),
      tooFast: t("messages:errors.tooFast"),
      tooLong: t("messages:errors.tooLong"),
      failed: t("messages:errors.failed"),
    },
  };
}
export type MessagesPageStrings = ReturnType<typeof messagesPageStrings>;
