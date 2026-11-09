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
      "profile.reset": t("admin:audit.actions.profileReset"),
      "sanction.create": t("admin:audit.actions.sanctionCreate"),
      "sanction.revoke": t("admin:audit.actions.sanctionRevoke"),
      "report.resolve": t("admin:audit.actions.reportResolve"),
      "report.dm_context": t("admin:audit.actions.dmContext"),
      "chat.delete": t("admin:audit.actions.chatDelete"),
      "room_chat.delete": t("admin:audit.actions.roomChatDelete"),
      "chat.slow_mode": t("admin:audit.actions.slowMode"),
      "game.update": t("admin:audit.actions.gameUpdate"),
      "room.close": t("admin:audit.actions.roomClose"),
      "match.accept": t("admin:audit.actions.matchAccept"),
      "match.reject": t("admin:audit.actions.matchReject"),
      "match.annul": t("admin:audit.actions.matchAnnul"),
      "leaderboard.remove": t("admin:audit.actions.boardRemove"),
      "leaderboard.reset_player": t("admin:audit.actions.boardResetPlayer"),
      "rating.reset": t("admin:audit.actions.ratingReset"),
    } as Record<string, string>,
    /** What an entry can be about (`target_type`). */
    targets: {
      user: t("admin:audit.targets.user"),
      avatar: t("admin:audit.targets.avatar"),
      message: t("admin:audit.targets.message"),
      room_message: t("admin:audit.targets.roomMessage"),
      lobby_name: t("admin:audit.targets.lobbyName"),
      chat_room: t("admin:audit.targets.chatRoom"),
      game: t("admin:audit.targets.game"),
      room: t("admin:audit.targets.room"),
      match: t("admin:audit.targets.match"),
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
    rejected: t("admin:integrity.statuses.rejected"),
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
    /** The actions on a player's page; placeholders are filled in on the client. */
    act: {
      title: t("admin:players.act.title"),
      resetNickname: t("admin:players.act.resetNickname"),
      resetAvatar: t("admin:players.act.resetAvatar"),
      resetBio: t("admin:players.act.resetBio"),
      resetNicknameTitle: t("admin:players.act.resetNicknameTitle", { name: "{name}" }),
      resetNicknameBody: t("admin:players.act.resetNicknameBody"),
      resetAvatarTitle: t("admin:players.act.resetAvatarTitle", { name: "{name}" }),
      resetAvatarBody: t("admin:players.act.resetAvatarBody"),
      resetBioTitle: t("admin:players.act.resetBioTitle", { name: "{name}" }),
      resetBioBody: t("admin:players.act.resetBioBody"),
      sanction: t("admin:players.act.sanction"),
      sanctionTitle: t("admin:players.act.sanctionTitle", { name: "{name}" }),
      sanctionBody: t("admin:players.act.sanctionBody"),
      kind: t("admin:players.act.kind"),
      duration: t("admin:players.act.duration"),
      durations: {
        h1: t("admin:players.act.durations.h1"),
        h24: t("admin:players.act.durations.h24"),
        d7: t("admin:players.act.durations.d7"),
        d30: t("admin:players.act.durations.d30"),
        none: t("admin:players.act.durations.none"),
      },
      note: t("admin:players.act.note"),
      noteHint: t("admin:players.act.noteHint"),
      give: t("admin:players.act.give"),
      revoke: t("admin:players.act.revoke"),
      revokeTitle: t("admin:players.act.revokeTitle"),
      makeModerator: t("admin:players.act.makeModerator"),
      removeModerator: t("admin:players.act.removeModerator"),
      makeAdmin: t("admin:players.act.makeAdmin"),
      removeAdmin: t("admin:players.act.removeAdmin"),
      roleBody: t("admin:players.act.roleBody", { name: "{name}" }),
      deleteAccount: t("admin:players.act.deleteAccount"),
      deleteTitle: t("admin:players.act.deleteTitle", { name: "{name}" }),
      deleteBody: t("admin:players.act.deleteBody"),
      cancelDeletion: t("admin:players.act.cancelDeletion"),
      cancelDeletionBody: t("admin:players.act.cancelDeletionBody", { name: "{name}" }),
      cancel: t("admin:players.act.cancel"),
      close: t("admin:players.act.close"),
      done: t("admin:players.act.done"),
      errors: {
        adminOnly: t("admin:players.act.errors.adminOnly"),
        rateLimited: t("admin:players.act.errors.rateLimited"),
        nothing: t("admin:players.act.errors.nothing"),
        staffAccount: t("admin:players.act.errors.staffAccount"),
        lastAdmin: t("admin:players.act.errors.lastAdmin"),
        failed: t("admin:players.act.errors.failed"),
      },
    },
  };
}

export type PlayersStrings = ReturnType<typeof playersStrings>;

export function reportsStrings(t: AppT) {
  return {
    type: t("admin:reports.type"),
    anyType: t("admin:reports.anyType"),
    types: {
      message: t("admin:reports.types.message"),
      room_message: t("admin:reports.types.roomMessage"),
      user: t("admin:reports.types.user"),
      avatar: t("admin:reports.types.avatar"),
    } as Record<string, string>,
    apply: t("admin:reports.apply"),
    empty: t("admin:reports.empty"),
    /** "Reports: {count}" */
    count: t("admin:reports.count", { count: "{count}" }),
    /** "First reported {ago}" */
    firstReported: t("admin:reports.firstReported", { ago: "{ago}" }),
    late: t("admin:reports.late"),
    veryLate: t("admin:reports.veryLate"),
    held: t("admin:reports.held"),
    dm: t("admin:reports.dm"),
    /** "Global chat · {room}" */
    globalRoom: t("admin:reports.globalRoom", { room: "{room}" }),
    /** "Lobby {code} · {game}" */
    lobby: t("admin:reports.lobby", { code: "{code}", game: "{game}" }),
    nickname: t("admin:reports.nickname"),
    deleted: t("admin:reports.deleted"),
    hidden: t("admin:reports.hidden"),
    gif: t("admin:reports.gif"),
    avatarAlt: t("admin:reports.avatarAlt"),
    reportedBy: t("admin:reports.reportedBy"),
    showContext: t("admin:reports.showContext"),
    contextTitle: t("admin:reports.contextTitle"),
    contextEmpty: t("admin:reports.contextEmpty"),
    contextDm: t("admin:reports.contextDm"),
    reportedMessage: t("admin:reports.reportedMessage"),
    dismiss: t("admin:reports.dismiss"),
    remove: t("admin:reports.remove"),
    removeAndSanction: t("admin:reports.removeAndSanction"),
    dismissTitle: t("admin:reports.dismissTitle"),
    dismissBody: t("admin:reports.dismissBody"),
    removeTitle: t("admin:reports.removeTitle"),
    removeBody: {
      message: t("admin:reports.removeBody.message"),
      room_message: t("admin:reports.removeBody.message"),
      user: t("admin:reports.removeBody.user"),
      avatar: t("admin:reports.removeBody.avatar"),
    } as Record<string, string>,
    sanctionBody: t("admin:reports.sanctionBody"),
    /** "Select {item}" */
    select: t("admin:reports.select", { item: "{item}" }),
    /** "Selected: {count}" */
    selected: t("admin:reports.selected", { count: "{count}" }),
    dismissSelected: t("admin:reports.dismissSelected"),
    removeSelected: t("admin:reports.removeSelected"),
    /** "Applies to the {count} selected." */
    bulkBody: t("admin:reports.bulkBody", { count: "{count}" }),
    done: t("admin:reports.done"),
    partial: t("admin:reports.partial"),
    loading: t("admin:loading"),
    failed: t("admin:failed"),
    retry: t("admin:retry"),
  };
}

export type ReportsStrings = ReturnType<typeof reportsStrings>;

export function chatStrings(t: AppT) {
  return {
    searchTitle: t("admin:chat.searchTitle"),
    scope: t("admin:chat.scope"),
    scopes: { global: t("admin:chat.scopes.global"), lobby: t("admin:chat.scopes.lobby") },
    room: t("admin:chat.room"),
    anyRoom: t("admin:chat.anyRoom"),
    query: t("admin:chat.query"),
    queryHint: t("admin:chat.queryHint"),
    sender: t("admin:chat.sender"),
    senderHint: t("admin:chat.senderHint"),
    search: t("admin:chat.search"),
    clear: t("admin:players.clear"),
    results: t("admin:chat.results"),
    empty: t("admin:chat.empty"),
    more: t("admin:chat.more"),
    /** "Global chat · {room}" */
    globalRoom: t("admin:reports.globalRoom", { room: "{room}" }),
    /** "Lobby {code} · {game}" */
    lobby: t("admin:reports.lobby", { code: "{code}", game: "{game}" }),
    hidden: t("admin:reports.held"),
    gif: t("admin:reports.gif"),
    delete: t("admin:chat.delete"),
    deleteTitle: t("admin:chat.deleteTitle"),
    deleteBody: t("admin:chat.deleteBody"),
    slowTitle: t("admin:chat.slowTitle"),
    slowBody: t("admin:chat.slowBody"),
    slowOff: t("admin:chat.slowOff"),
    save: t("admin:chat.save"),
    /** "Save slow mode for {room}" */
    slowSave: t("admin:chat.slowSave", { room: "{room}" }),
    /** "Slow mode in {room}: {value}." */
    slowSaved: t("admin:chat.slowSaved", { room: "{room}", value: "{value}" }),
    mutedTitle: t("admin:chat.mutedTitle"),
    mutedEmpty: t("admin:chat.mutedEmpty"),
    noEnd: t("admin:chat.noEnd"),
    /** "Ends {date}" */
    endsAt: t("admin:chat.endsAt", { date: "{date}" }),
    /** "Lift {name}'s mute" */
    unmute: t("admin:chat.unmute", { name: "{name}" }),
    unmuteBody: t("admin:chat.unmuteBody"),
    done: t("admin:reports.done"),
    loading: t("admin:loading"),
    failed: t("admin:failed"),
    retry: t("admin:retry"),
  };
}

export type ChatStrings = ReturnType<typeof chatStrings>;

export function gamesStrings(t: AppT) {
  return {
    settingsTitle: t("admin:games.settingsTitle"),
    settingsBody: t("admin:games.settingsBody"),
    /** "{game}'s settings" */
    settingsOf: t("admin:games.settingsOf", { game: "{game}" }),
    flags: {
      enabled: t("admin:games.flags.enabled"),
      featured: t("games:badges.featured"),
      is_new: t("games:badges.new"),
      hot: t("games:badges.hot"),
      beta: t("games:badges.beta"),
    },
    off: t("admin:games.off"),
    offNote: t("admin:games.offNote"),
    position: t("admin:games.position"),
    positionHint: t("admin:games.positionHint"),
    save: t("admin:games.save"),
    /** "Save {game}" */
    saveLabel: t("admin:games.saveLabel", { game: "{game}" }),
    /** "{game} saved." */
    saved: t("admin:games.saved", { game: "{game}" }),
    matchesDay: t("admin:games.matchesDay"),
    matchesWeek: t("admin:games.matchesWeek"),
    matchesAll: t("admin:games.matchesAll"),
    playersWeek: t("admin:games.playersWeek"),
    inReview: t("admin:games.inReview"),
    openRooms: t("admin:games.openRooms"),
    arenas: t("admin:games.arenas"),
    /** "{arenas} open, {people} playing" */
    arenasValue: t("admin:games.arenasValue", { arenas: "{arenas}", people: "{people}" }),
    roomsTitle: t("admin:games.roomsTitle"),
    game: t("admin:games.game"),
    anyGame: t("admin:games.anyGame"),
    show: t("admin:reports.apply"),
    noRooms: t("admin:games.noRooms"),
    lobby: t("admin:games.lobby"),
    playing: t("admin:games.playing"),
    public: t("admin:games.public"),
    private: t("admin:games.private"),
    rated: t("admin:players.rated"),
    /** "Players: {count} of {seats}" */
    playersValue: t("admin:games.playersValue", { count: "{count}", seats: "{seats}" }),
    /** "Spectators: {count}" */
    spectatorsValue: t("admin:games.spectatorsValue", { count: "{count}" }),
    host: t("admin:games.host"),
    close: t("admin:games.close"),
    closeRoom: t("admin:games.closeRoom"),
    /** "Close room {code}" */
    closeLabel: t("admin:games.closeLabel", { code: "{code}" }),
    /** "Close room {code}?" */
    closeTitle: t("admin:games.closeTitle", { code: "{code}" }),
    closeBody: t("admin:games.closeBody"),
    /** "Room {code} closed." */
    closed: t("admin:games.closed", { code: "{code}" }),
    alreadyClosed: t("admin:games.alreadyClosed"),
    loading: t("admin:loading"),
    failed: t("admin:failed"),
    retry: t("admin:retry"),
  };
}

export type GamesStrings = ReturnType<typeof gamesStrings>;

export function integrityStrings(t: AppT) {
  return {
    reviewTitle: t("admin:integrity.reviewTitle"),
    reviewBody: t("admin:integrity.reviewBody"),
    reviewEmpty: t("admin:integrity.reviewEmpty"),
    matchTitle: t("admin:integrity.matchTitle"),
    matchBody: t("admin:integrity.matchBody"),
    matchId: t("admin:integrity.matchId"),
    matchIdHint: t("admin:integrity.matchIdHint"),
    find: t("admin:integrity.find"),
    matchNotFound: t("admin:integrity.matchNotFound"),
    boardsTitle: t("admin:integrity.boardsTitle"),
    boardsBody: t("admin:integrity.boardsBody"),
    board: t("admin:integrity.board"),
    chooseBoard: t("admin:integrity.chooseBoard"),
    period: t("admin:integrity.period"),
    allTime: t("admin:integrity.allTime"),
    thisWeek: t("admin:integrity.thisWeek"),
    boardEmpty: t("admin:integrity.boardEmpty"),
    notShown: t("admin:integrity.notShown"),
    removeEntryBody: t("admin:integrity.removeEntryBody"),
    remove: t("admin:integrity.remove"),
    xpBoard: t("admin:integrity.xpBoard"),
    playerTitle: t("admin:integrity.playerTitle"),
    playerBody: t("admin:integrity.playerBody"),
    player: t("admin:integrity.player"),
    playerHint: t("admin:integrity.playerHint"),
    playerNotFound: t("admin:integrity.playerNotFound"),
    ratings: t("admin:integrity.ratings"),
    noRatings: t("admin:integrity.noRatings"),
    resetRatingBody: t("admin:integrity.resetRatingBody"),
    reset: t("admin:integrity.reset"),
    places: t("admin:integrity.places"),
    noPlaces: t("admin:integrity.noPlaces"),
    resetBoards: t("admin:integrity.resetBoards"),
    resetBoardsBody: t("admin:integrity.resetBoardsBody"),
    assisted: t("admin:integrity.assisted"),
    accept: t("admin:integrity.accept"),
    acceptBody: t("admin:integrity.acceptBody"),
    reject: t("admin:integrity.reject"),
    rejectBody: t("admin:integrity.rejectBody"),
    annul: t("admin:integrity.annul"),
    annulBody: t("admin:integrity.annulBody"),
    annulRated: t("admin:integrity.annulRated"),
    removeEntryLabel: t("admin:integrity.removeEntryLabel", { name: "{name}" }),
    removeEntryTitle: t("admin:integrity.removeEntryTitle", { name: "{name}" }),
    ratingValue: t("admin:integrity.ratingValue", {
      rating: "{rating}",
      rd: "{rd}",
      games: "{games}",
    }),
    resetRatingLabel: t("admin:integrity.resetRatingLabel", { rating: "{rating}" }),
    resetRatingTitle: t("admin:integrity.resetRatingTitle", { name: "{name}", rating: "{rating}" }),
    resetBoardsLabel: t("admin:integrity.resetBoardsLabel", { game: "{game}" }),
    resetBoardsTitle: t("admin:integrity.resetBoardsTitle", { name: "{name}", game: "{game}" }),
    reason: t("admin:integrity.reason", { reason: "{reason}" }),
    score: t("admin:integrity.score", { score: "{score}" }),
    time: t("admin:integrity.time", { time: "{time}" }),
    acceptTitle: t("admin:integrity.acceptTitle", { game: "{game}" }),
    rejectTitle: t("admin:integrity.rejectTitle", { game: "{game}" }),
    annulTitle: t("admin:integrity.annulTitle", { game: "{game}" }),
    show: t("admin:reports.apply"),
    statuses: {
      counted: t("admin:integrity.statuses.counted"),
      review: t("admin:integrity.statuses.review"),
      rejected: t("admin:integrity.statuses.rejected"),
    } as Record<string, string>,
    modes: {
      solo: t("admin:integrity.modes.solo"),
      "solo-bots": t("admin:integrity.modes.soloBots"),
      hotseat: t("admin:integrity.modes.hotseat"),
      race: t("admin:integrity.modes.race"),
      online: t("admin:integrity.modes.online"),
      daily: t("admin:integrity.modes.daily"),
    } as Record<string, string>,
    done: t("admin:reports.done"),
    loading: t("admin:loading"),
    failed: t("admin:failed"),
  };
}

export type IntegrityStrings = ReturnType<typeof integrityStrings>;

/** What the page's section shows, with the strings it needs (built on the server). */
export function adminView(section: AdminSectionId, t: AppT, locale: Locale): AdminView {
  if (section === "audit") return { section, strings: auditStrings(t) };
  if (section === "users") return { section, strings: playersStrings(t, locale) };
  if (section === "reports")
    return { section, strings: reportsStrings(t), players: playersStrings(t, locale) };
  if (section === "chat")
    return { section, strings: chatStrings(t), players: playersStrings(t, locale) };
  if (section === "games")
    return { section, strings: gamesStrings(t), players: playersStrings(t, locale) };
  if (section === "integrity")
    return { section, strings: integrityStrings(t), players: playersStrings(t, locale) };
  return { section };
}
