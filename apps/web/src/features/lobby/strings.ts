// Text for online play (Phase 5), translated on the page and passed to islands.
import type { AuthErrorKey } from "@/features/auth/errors";
import type { AppT } from "@/i18n/i18n";

export interface GuestStrings {
  title: string;
  intro: string;
  nickname: string;
  submit: string;
  privacyNote: string;
  privacyLink: string;
  errors: Record<AuthErrorKey, string>;
}

export function guestStrings(t: AppT, errors: Record<AuthErrorKey, string>): GuestStrings {
  return {
    title: t("lobby:guest.title"),
    intro: t("lobby:guest.intro"),
    nickname: t("lobby:guest.nickname"),
    submit: t("lobby:guest.submit"),
    privacyNote: t("legal:privacy.signUpNote"),
    privacyLink: t("legal:privacy.title"),
    errors,
  };
}

export interface RoomStrings {
  title: string;
  description: string;
  create: string;
  join: string;
  joinTitle: string;
  codeLabel: string;
  codeHint: string;
  joinSubmit: string;
  creating: string;
  joining: string;
  code: string;
  copyLink: string;
  copied: string;
  share: string;
  showQr: string;
  hideQr: string;
  qrLabel: string;
  shareText: string;
  seats: string;
  seatEmpty: string;
  seatBot: string;
  host: string;
  you: string;
  ready: string;
  notReady: string;
  away: string;
  watching: string;
  setReady: string;
  unsetReady: string;
  start: string;
  startHint: string;
  countdown: string;
  settings: string;
  visibility: string;
  private: string;
  public: string;
  allowSpectators: string;
  lock: string;
  unlock: string;
  locked: string;
  makeBot: string;
  openSeat: string;
  kick: string;
  makeHost: string;
  leave: string;
  backToLobby: string;
  rematch: string;
  waitingHost: string;
  spectating: string;
  signedOut: string;
  playOnline: string;
  onboarding: string;
  onboardingLink: string;
  backToGame: string;
  errors: Record<RoomErrorCode, string>;
}

export interface ChatStrings {
  title: string;
  label: string;
  send: string;
  empty: string;
  you: string;
  show: string;
  hide: string;
  /** "New messages: {count}", on the folded chat's button. */
  unread: string;
  tooFast: string;
  tooLong: string;
  failed: string;
}

export function chatStrings(t: AppT): ChatStrings {
  return {
    title: t("lobby:chat.title"),
    label: t("lobby:chat.label"),
    send: t("lobby:chat.send"),
    empty: t("lobby:chat.empty"),
    you: t("lobby:room.you"),
    show: t("lobby:chat.show"),
    hide: t("lobby:chat.hide"),
    unread: t("lobby:chat.unread", { count: "{count}" }),
    tooFast: t("lobby:chat.tooFast"),
    tooLong: t("lobby:chat.tooLong"),
    failed: t("lobby:errors.unknown"),
  };
}

export const ROOM_ERROR_CODES = [
  "room_not_found",
  "room_closed",
  "room_locked",
  "room_full",
  "room_kicked",
  "room_started",
  "not_host",
  "not_ready",
  "seats_empty",
  "seat_taken",
  "rate_limited",
  "connection",
  "unknown",
] as const;
export type RoomErrorCode = (typeof ROOM_ERROR_CODES)[number];

export function roomStrings(t: AppT): RoomStrings {
  return {
    title: t("lobby:room.title"),
    description: t("lobby:room.description"),
    create: t("lobby:room.create"),
    join: t("lobby:room.join"),
    joinTitle: t("lobby:room.joinTitle"),
    codeLabel: t("lobby:room.codeLabel"),
    codeHint: t("lobby:room.codeHint"),
    joinSubmit: t("lobby:room.joinSubmit"),
    creating: t("lobby:room.creating"),
    joining: t("lobby:room.joining"),
    code: t("lobby:room.code"),
    copyLink: t("lobby:room.copyLink"),
    copied: t("lobby:room.copied"),
    share: t("lobby:room.share"),
    showQr: t("lobby:room.showQr"),
    hideQr: t("lobby:room.hideQr"),
    qrLabel: t("lobby:room.qrLabel"),
    shareText: t("lobby:room.shareText", { game: "{game}" }),
    seats: t("lobby:room.seats"),
    seatEmpty: t("lobby:room.seatEmpty"),
    seatBot: t("lobby:room.seatBot"),
    host: t("lobby:room.host"),
    you: t("lobby:room.you"),
    ready: t("lobby:room.ready"),
    notReady: t("lobby:room.notReady"),
    away: t("lobby:room.away"),
    watching: t("lobby:room.watching", { count: "{count}" }),
    setReady: t("lobby:room.setReady"),
    unsetReady: t("lobby:room.unsetReady"),
    start: t("lobby:room.start"),
    startHint: t("lobby:room.startHint"),
    countdown: t("lobby:room.countdown", { seconds: "{seconds}" }),
    settings: t("lobby:room.settings"),
    visibility: t("lobby:room.visibility"),
    private: t("lobby:room.private"),
    public: t("lobby:room.public"),
    allowSpectators: t("lobby:room.allowSpectators"),
    lock: t("lobby:room.lock"),
    unlock: t("lobby:room.unlock"),
    locked: t("lobby:room.locked"),
    makeBot: t("lobby:room.makeBot"),
    openSeat: t("lobby:room.openSeat"),
    kick: t("lobby:room.kick", { name: "{name}" }),
    makeHost: t("lobby:room.makeHost", { name: "{name}" }),
    leave: t("lobby:room.leave"),
    backToLobby: t("lobby:room.backToLobby"),
    rematch: t("lobby:room.rematch"),
    waitingHost: t("lobby:room.waitingHost"),
    spectating: t("lobby:room.spectating"),
    signedOut: t("lobby:room.signedOut"),
    playOnline: t("lobby:room.playOnline"),
    onboarding: t("lobby:room.onboarding"),
    onboardingLink: t("lobby:room.onboardingLink"),
    backToGame: t("lobby:room.backToGame"),
    errors: {
      room_not_found: t("lobby:errors.room_not_found"),
      room_closed: t("lobby:errors.room_closed"),
      room_locked: t("lobby:errors.room_locked"),
      room_full: t("lobby:errors.room_full"),
      room_kicked: t("lobby:errors.room_kicked"),
      room_started: t("lobby:errors.room_started"),
      not_host: t("lobby:errors.not_host"),
      not_ready: t("lobby:errors.not_ready"),
      seats_empty: t("lobby:errors.seats_empty"),
      seat_taken: t("lobby:errors.seat_taken"),
      rate_limited: t("lobby:errors.rate_limited"),
      connection: t("lobby:errors.connection"),
      unknown: t("lobby:errors.unknown"),
    },
  };
}
