import type { AppT } from "@/i18n/i18n";

import type { FriendErrorCode } from "./friends-data";

/**
 * The strings friend features show, translated on the server and passed to
 * the friends page's island and the profile. `{name}`, `{date}` and
 * `{count}` are filled in on the client.
 */
export function friendsStrings(t: AppT) {
  const errors: Record<FriendErrorCode, string> = {
    invalid_user: t("friends:errors.invalid_user"),
    unavailable: t("friends:errors.unavailable"),
    too_many_requests: t("friends:errors.too_many_requests"),
    too_many_blocks: t("friends:errors.too_many_blocks"),
    rate_limited: t("friends:errors.rate_limited"),
    accounts_only: t("friends:errors.accounts_only"),
    unknown: t("friends:errors.unknown"),
  };
  return {
    errors,
    actions: {
      add: t("friends:actions.add"),
      accept: t("friends:actions.accept"),
      decline: t("friends:actions.decline"),
      cancel: t("friends:actions.cancel"),
      remove: t("friends:actions.remove"),
      block: t("friends:actions.block"),
      unblock: t("friends:actions.unblock"),
      invite: t("friends:actions.invite"),
    },
    invite: {
      title: t("friends:invite.title", { name: "{name}" }),
      hint: t("friends:invite.hint", { name: "{name}" }),
    },
    status: {
      requested: t("friends:status.requested"),
      incoming: t("friends:status.incoming"),
      friends: t("friends:status.friends"),
      blocked: t("friends:status.blocked"),
    },
    confirm: {
      removeTitle: t("friends:confirm.removeTitle", { name: "{name}" }),
      removeBody: t("friends:confirm.removeBody"),
      blockTitle: t("friends:confirm.blockTitle", { name: "{name}" }),
      blockBody: t("friends:confirm.blockBody"),
      keep: t("friends:confirm.keep"),
      close: t("friends:confirm.close"),
    },
    presence: {
      online: t("friends:presence.online"),
      lobby: t("friends:presence.lobby", { game: "{game}" }),
      playing: t("friends:presence.playing", { game: "{game}" }),
      away: t("friends:presence.away"),
    },
    mutual: t("friends:mutual"),
    mutualMore: t("friends:mutualMore", { count: "{count}" }),
  };
}
export type FriendsStrings = ReturnType<typeof friendsStrings>;

/** The friends page's own strings, beside the shared ones. */
export function friendsPageStrings(t: AppT) {
  return {
    ...friendsStrings(t),
    tabs: {
      friends: t("friends:tabs.friends"),
      requests: t("friends:tabs.requests"),
      blocked: t("friends:tabs.blocked"),
    },
    add: {
      label: t("friends:add.label"),
      submit: t("friends:add.submit"),
      requested: t("friends:add.requested", { name: "{name}" }),
      friends: t("friends:add.friends", { name: "{name}" }),
      notFound: t("friends:add.notFound"),
    },
    list: {
      since: t("friends:list.since", { date: "{date}" }),
      incoming: t("friends:list.incoming"),
      outgoing: t("friends:list.outgoing"),
      blockedOn: t("friends:list.blockedOn", { date: "{date}" }),
    },
    empty: {
      friends: t("friends:empty.friends"),
      friendsHint: t("friends:empty.friendsHint"),
      requests: t("friends:empty.requests"),
      blocked: t("friends:empty.blocked"),
    },
    loading: t("friends:loading"),
    failed: t("friends:failed"),
    retry: t("friends:retry"),
  };
}
export type FriendsPageStrings = ReturnType<typeof friendsPageStrings>;
