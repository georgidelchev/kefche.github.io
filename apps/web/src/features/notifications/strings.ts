import type { AppT } from "@/i18n/i18n";

import type { NotificationStrings, OptionalType } from "./notifications-data";

/** How notifications read, translated on the server; placeholders are filled in on the client. */
export function notificationStrings(t: AppT): NotificationStrings {
  return {
    someone: t("notifications:someone"),
    types: {
      friend_request: t("notifications:types.friend_request", { name: "{name}" }),
      friend_accepted: t("notifications:types.friend_accepted", { name: "{name}" }),
      invite: t("notifications:types.invite", { name: "{name}", game: "{game}" }),
      message: t("notifications:types.message", { name: "{name}" }),
      achievement: t("notifications:types.achievement", { name: "{name}", tier: "{tier}" }),
      rating: t("notifications:types.rating", {
        game: "{game}",
        pool: "{pool}",
        rating: "{rating}",
      }),
      daily: t("notifications:types.daily", {
        date: "{date}",
        game: "{game}",
        rank: "{rank}",
        total: "{total}",
      }),
    },
    moderation: {
      warn: t("notifications:moderation.warn"),
      muteUntil: t("notifications:moderation.muteUntil", { until: "{until}" }),
      mute: t("notifications:moderation.mute"),
      suspendUntil: t("notifications:moderation.suspendUntil", { until: "{until}" }),
      suspend: t("notifications:moderation.suspend"),
      ban: t("notifications:moderation.ban"),
      reason: t("notifications:moderation.reason", { reason: "{reason}" }),
    },
    reasons: {
      spam: t("notifications:reasons.spam"),
      harassment: t("notifications:reasons.harassment"),
      hate: t("notifications:reasons.hate"),
      sexual: t("notifications:reasons.sexual"),
      selfHarm: t("notifications:reasons.selfHarm"),
      cheating: t("notifications:reasons.cheating"),
      filter: t("notifications:reasons.filter"),
      other: t("notifications:reasons.other"),
    },
    tiers: {
      bronze: t("profile:tier.bronze"),
      silver: t("profile:tier.silver"),
      gold: t("profile:tier.gold"),
    },
    pools: {
      bullet: t("lobby:rated.pools.bullet"),
      blitz: t("lobby:rated.pools.blitz"),
      rapid: t("lobby:rated.pools.rapid"),
      classical: t("lobby:rated.pools.classical"),
    },
  };
}

/** The notifications page's own strings, beside how notifications read. */
export function notificationsPageStrings(t: AppT) {
  return {
    ...notificationStrings(t),
    loading: t("notifications:loading"),
    failed: t("notifications:failed"),
    retry: t("notifications:retry"),
    empty: t("notifications:empty"),
    emptyHint: t("notifications:emptyHint"),
    more: t("notifications:more"),
    new: t("notifications:new"),
  };
}
export type NotificationsPageStrings = ReturnType<typeof notificationsPageStrings>;

/** The settings section: what each optional type is called. */
export function notificationSettingsStrings(t: AppT) {
  const types: Record<OptionalType, string> = {
    friend_request: t("settings:notifications.types.friend_request"),
    friend_accepted: t("settings:notifications.types.friend_accepted"),
    invite: t("settings:notifications.types.invite"),
    message: t("settings:notifications.types.message"),
    achievement: t("settings:notifications.types.achievement"),
    rating: t("settings:notifications.types.rating"),
    daily: t("settings:notifications.types.daily"),
  };
  return {
    hint: t("settings:notifications.hint"),
    types,
    saved: t("settings:saved"),
    saveFailed: t("settings:saveFailed"),
  };
}
export type NotificationSettingsStrings = ReturnType<typeof notificationSettingsStrings>;
