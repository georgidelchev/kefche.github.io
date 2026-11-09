import { gameNames } from "@/features/games/game-names";
import type { AppT } from "@/i18n/i18n";
import type { Locale } from "@/i18n/locales";

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

export function playersStrings(t: AppT, locale: Locale) {
  return {
    search: t("admin:players.search"),
    query: t("admin:players.query"),
    queryHint: t("admin:players.queryHint"),
    queryHintAdmin: t("admin:players.queryHintAdmin"),
    role: t("admin:players.role"),
    anyRole: t("admin:players.anyRole"),
    roles: {
      staff: t("admin:players.roles.staff"),
      admin: t("admin:players.roles.admin"),
      moderator: t("admin:players.roles.moderator"),
      none: t("admin:players.roles.none"),
    },
    sanction: t("admin:players.sanction"),
    anySanction: t("admin:players.anySanction"),
    sanctions: {
      any: t("admin:players.sanctions.any"),
      mute: t("admin:players.sanctions.mute"),
      suspend: t("admin:players.sanctions.suspend"),
      ban: t("admin:players.sanctions.ban"),
    },
    account: t("admin:players.account"),
    anyAccount: t("admin:players.anyAccount"),
    accounts: {
      account: t("admin:players.accounts.account"),
      guest: t("admin:players.accounts.guest"),
    },
    apply: t("admin:players.apply"),
    clear: t("admin:players.clear"),
    results: t("admin:players.results"),
    empty: t("admin:players.empty"),
    more: t("admin:players.more"),
    noNickname: t("admin:players.noNickname"),
    guest: t("admin:players.guest"),
    /** "Joined {date}" */
    joined: t("admin:players.joined", { date: "{date}" }),
    notFound: t("admin:players.notFound"),
    back: t("admin:players.back"),
    profile: t("admin:players.profile"),
    inAudit: t("admin:players.inAudit"),
    id: t("admin:players.id"),
    email: t("admin:players.email"),
    joinedAt: t("admin:players.joinedAt"),
    lastSignIn: t("admin:players.lastSignIn"),
    never: t("admin:players.never"),
    level: t("admin:players.level"),
    /** "Level {level} · {xp} XP" */
    levelValue: t("admin:players.levelValue", { level: "{level}", xp: "{xp}" }),
    country: t("admin:players.country"),
    nicknameChanged: t("admin:players.nicknameChanged"),
    deletion: t("admin:players.deletion"),
    bio: t("admin:players.bio"),
    noBio: t("admin:players.noBio"),
    sanctionsTitle: t("admin:players.sanctionsTitle"),
    noSanctions: t("admin:players.noSanctions"),
    kinds: {
      warn: t("admin:players.kinds.warn"),
      mute: t("admin:players.kinds.mute"),
      suspend: t("admin:players.kinds.suspend"),
      ban: t("admin:players.kinds.ban"),
    } as Record<string, string>,
    reason: t("admin:players.reason"),
    /** A sanction's or a report's reason, as the database stores it. */
    reasons: {
      spam: t("common:report.reasons.spam"),
      harassment: t("common:report.reasons.harassment"),
      hate: t("common:report.reasons.hate"),
      sexual: t("common:report.reasons.sexual"),
      "self-harm": t("common:report.reasons.selfHarm"),
      cheating: t("common:report.reasons.cheating"),
      other: t("common:report.reasons.other"),
      filter: t("admin:players.reasonFilter"),
    } as Record<string, string>,
    note: t("admin:players.note"),
    inForce: t("admin:players.inForce"),
    given: t("admin:players.given"),
    ends: t("admin:players.ends"),
    noEnd: t("admin:players.noEnd"),
    by: t("admin:players.by"),
    automatic: t("admin:players.automatic"),
    revoked: t("admin:players.revoked"),
    revokedBy: t("admin:players.revokedBy"),
    reportsAbout: t("admin:players.reportsAbout"),
    reportsBy: t("admin:players.reportsBy"),
    noReports: t("admin:players.noReports"),
    reporter: t("admin:players.reporter"),
    reported: t("admin:players.reported"),
    statuses: {
      open: t("admin:players.statuses.open"),
      dismissed: t("admin:players.statuses.dismissed"),
      actioned: t("admin:players.statuses.actioned"),
    } as Record<string, string>,
    /** What a report is about (`target_type`), as the audit log names it. */
    targets: auditStrings(t).targets,
    matches: t("admin:players.matches"),
    noMatches: t("admin:players.noMatches"),
    outcomes: {
      win: t("admin:players.outcomes.win"),
      loss: t("admin:players.outcomes.loss"),
      draw: t("admin:players.outcomes.draw"),
    },
    /** "Against {names}" */
    against: t("admin:players.against", { names: "{names}" }),
    rated: t("admin:players.rated"),
    review: t("admin:players.review"),
    noProfile: t("admin:audit.noProfile"),
    staffRoles: { admin: t("admin:role.admin"), moderator: t("admin:role.moderator") } as Record<
      string,
      string
    >,
    loading: t("admin:loading"),
    failed: t("admin:failed"),
    retry: t("admin:retry"),
    /** Every game's name, by id. */
    games: gameNames(locale),
  };
}

export type PlayersStrings = ReturnType<typeof playersStrings>;

/** What the page's section shows, with the strings it needs (built on the server). */
export function adminView(section: AdminSectionId, t: AppT, locale: Locale): AdminView {
  if (section === "audit") return { section, strings: auditStrings(t) };
  if (section === "users") return { section, strings: playersStrings(t, locale) };
  return { section };
}
