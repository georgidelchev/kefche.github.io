import type { AppT } from "@/i18n/i18n";

import { ADMIN_LABEL_KEYS, ADMIN_SECTIONS, type AdminSectionId } from "./sections";

import type { AdminView } from "./views";

/** The admin shell's strings: the menu, its states and the section names. */
export function adminStrings(t: AppT) {
  return {
    menu: t("admin:menu"),
    loading: t("admin:loading"),
    failed: t("admin:failed"),
    retry: t("admin:retry"),
    staffOnly: t("admin:staffOnly"),
    staffOnlyBody: t("admin:staffOnlyBody"),
    home: t("common:comingSoon.back"),
    adminOnly: t("admin:adminOnly"),
    pending: t("admin:pending"),
    role: { admin: t("admin:role.admin"), moderator: t("admin:role.moderator") },
    sections: Object.fromEntries(
      ADMIN_SECTIONS.map(({ id }) => [id, t(ADMIN_LABEL_KEYS[id])]),
    ) as Record<AdminSectionId, string>,
  };
}

export type AdminStrings = ReturnType<typeof adminStrings>;

export function auditStrings(t: AppT) {
  return {
    filters: t("admin:audit.filters"),
    actor: t("admin:audit.actor"),
    actorHint: t("admin:audit.actorHint"),
    action: t("admin:audit.action"),
    anyAction: t("admin:audit.anyAction"),
    targetType: t("admin:audit.targetType"),
    anyTarget: t("admin:audit.anyTarget"),
    target: t("admin:audit.target"),
    from: t("admin:audit.from"),
    to: t("admin:audit.to"),
    apply: t("admin:audit.apply"),
    clear: t("admin:audit.clear"),
    unknownActor: t("admin:audit.unknownActor"),
    unknownTarget: t("admin:audit.unknownTarget"),
    empty: t("admin:audit.empty"),
    more: t("admin:audit.more"),
    system: t("admin:audit.system"),
    noProfile: t("admin:audit.noProfile"),
    by: t("admin:audit.by"),
    about: t("admin:audit.about"),
    details: t("admin:audit.details"),
    profile: t("admin:audit.profile"),
    /** "Only {name}'s actions" */
    onlyActor: t("admin:audit.onlyActor", { name: "{name}" }),
    /** "Only entries about {name}" */
    onlyTarget: t("admin:audit.onlyTarget", { name: "{name}" }),
    loading: t("admin:loading"),
    failed: t("admin:failed"),
    retry: t("admin:retry"),
    /** Every audited action (`private.audit` calls), by its name in the log. */
    actions: {
      "role.grant": t("admin:audit.actions.roleGrant"),
      "role.revoke": t("admin:audit.actions.roleRevoke"),
      "account.merge_guest": t("admin:audit.actions.mergeGuest"),
      "account.deletion_requested": t("admin:audit.actions.deletionRequested"),
      "account.deletion_cancelled": t("admin:audit.actions.deletionCancelled"),
      "account.purged": t("admin:audit.actions.purged"),
      "sanction.create": t("admin:audit.actions.sanctionCreate"),
      "sanction.revoke": t("admin:audit.actions.sanctionRevoke"),
      "report.resolve": t("admin:audit.actions.reportResolve"),
      "chat.delete": t("admin:audit.actions.chatDelete"),
      "room_chat.delete": t("admin:audit.actions.roomChatDelete"),
      "chat.slow_mode": t("admin:audit.actions.slowMode"),
    } as Record<string, string>,
    /** What an entry can be about (`target_type`). */
    targets: {
      user: t("admin:audit.targets.user"),
      avatar: t("admin:audit.targets.avatar"),
      message: t("admin:audit.targets.message"),
      room_message: t("admin:audit.targets.roomMessage"),
      lobby_name: t("admin:audit.targets.lobbyName"),
      chat_room: t("admin:audit.targets.chatRoom"),
    } as Record<string, string>,
  };
}

export type AuditStrings = ReturnType<typeof auditStrings>;

/** What the page's section shows, with the strings it needs (built on the server). */
export function adminView(section: AdminSectionId, t: AppT): AdminView {
  if (section === "audit") return { section, strings: auditStrings(t) };
  return { section };
}
