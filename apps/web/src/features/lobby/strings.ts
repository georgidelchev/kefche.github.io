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
  quick: string;
  /** Games with rated play: quick match is "Play casual", beside "Play rated". */
  playCasual: string;
  playRated: string;
  finding: string;
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
  /** "You can't play online until {until}." (`errors.suspended`: without an end). */
  suspendedUntil: string;
  errors: Record<RoomErrorCode, string>;
  rated: RatedStrings;
}

/** Rated games (Phase 6): matchmaking, the badge and the result's rating change. */
export interface RatedStrings {
  /** "Rated · {pool}" */
  badge: string;
  /** Pool names by manifest pool id; an unknown pool shows its id. */
  pools: Record<string, string>;
  checking: string;
  /** "Your rating: {before} → {after} ({change})" */
  change: string;
  review: string;
  failed: string;
  title: string;
  intro: string;
  /** A lobby's game type: casual or rated. */
  mode: string;
  casual: string;
  rated: string;
  lobbyHint: string;
  accountsOnly: string;
  signIn: string;
  searching: string;
  /** "{clock} · {pool}" */
  clock: string;
  /** "Searching now: {count}" */
  searchingNow: string;
  /** "Estimated wait: about {time}" */
  wait: string;
  waitUnknown: string;
  /** "Opponents rated {low}–{high}" */
  range: string;
  cancel: string;
  newOpponent: string;
  viewGame: string;
}

export interface ChatStrings {
  title: string;
  label: string;
  send: string;
  empty: string;
  hint: string;
  you: string;
  show: string;
  hide: string;
  /** "New messages: {count}", on the folded chat's button. */
  unread: string;
  tooFast: string;
  tooLong: string;
  /** "You're muted until {until}." */
  mutedUntil: string;
  /** A mute without an end. */
  muted: string;
  failed: string;
}

export function chatStrings(t: AppT): ChatStrings {
  return {
    title: t("lobby:chat.title"),
    label: t("lobby:chat.label"),
    send: t("lobby:chat.send"),
    empty: t("lobby:chat.empty"),
    hint: t("lobby:chat.hint"),
    you: t("lobby:room.you"),
    show: t("lobby:chat.show"),
    hide: t("lobby:chat.hide"),
    unread: t("lobby:chat.unread", { count: "{count}" }),
    tooFast: t("lobby:chat.tooFast"),
    tooLong: t("lobby:chat.tooLong"),
    mutedUntil: t("lobby:chat.mutedUntil", { until: "{until}" }),
    muted: t("lobby:chat.muted"),
    failed: t("lobby:errors.unknown"),
  };
}

export interface LobbyBrowserStrings {
  filter: string;
  allGames: string;
  create: string;
  quick: string;
  listLabel: string;
  loading: string;
  failed: string;
  empty: string;
  emptyCreate: string;
  /** The "pick a game" dialog for a new lobby, from All games. */
  pickTitle: string;
  pickHint: string;
  close: string;
  waiting: string;
  playing: string;
  /** "Host: {name}" */
  host: string;
  /** "Seats: {taken}/{total}" */
  seats: string;
  join: string;
  watch: string;
  unavailable: string;
}

export function lobbyBrowserStrings(t: AppT): LobbyBrowserStrings {
  return {
    filter: t("lobby:browser.filter"),
    allGames: t("lobby:browser.allGames"),
    create: t("lobby:browser.create"),
    quick: t("lobby:room.quick"),
    listLabel: t("lobby:browser.listLabel"),
    loading: t("lobby:browser.loading"),
    failed: t("lobby:browser.failed"),
    empty: t("lobby:browser.empty"),
    emptyCreate: t("lobby:browser.emptyCreate"),
    pickTitle: t("lobby:browser.pickTitle"),
    pickHint: t("lobby:browser.pickHint"),
    close: t("common:actions.close"),
    waiting: t("lobby:browser.waiting"),
    playing: t("lobby:browser.playing"),
    host: t("lobby:browser.host", { name: "{name}" }),
    seats: t("lobby:browser.seats", { taken: "{taken}", total: "{total}" }),
    join: t("lobby:room.joinSubmit"),
    watch: t("lobby:browser.watch"),
    unavailable: t("lobby:room.signedOut"),
  };
}

/** Race mode (Phase 5 step 10): the lobby's time limit and the race screen. */
export interface RaceStrings {
  timeLimit: string;
  /** "{minutes} min" */
  minutes: string;
  standings: string;
  timeLeft: string;
  /** "{percent}%" */
  progress: string;
  /** "{score} points" */
  points: string;
  solved: string;
  gameOver: string;
  waitingOthers: string;
  timeUp: string;
  allFinished: string;
  checking: string;
  notChecked: string;
  /** "You finished #{place} of {count}" */
  yourPlace: string;
  youWon: string;
}

export function raceStrings(t: AppT): RaceStrings {
  return {
    timeLimit: t("lobby:race.timeLimit"),
    minutes: t("lobby:race.minutes", { minutes: "{minutes}" }),
    standings: t("lobby:race.standings"),
    timeLeft: t("lobby:race.timeLeft"),
    progress: t("lobby:race.progress", { percent: "{percent}" }),
    points: t("lobby:race.points", { score: "{score}" }),
    solved: t("lobby:race.solved"),
    gameOver: t("lobby:race.gameOver"),
    waitingOthers: t("lobby:race.waitingOthers"),
    timeUp: t("lobby:race.timeUp"),
    allFinished: t("lobby:race.allFinished"),
    checking: t("lobby:race.checking"),
    notChecked: t("lobby:race.notChecked"),
    yourPlace: t("lobby:race.yourPlace", { place: "{place}", count: "{count}" }),
    youWon: t("lobby:race.youWon"),
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
  "accounts_only",
  "rated_guests",
  "suspended",
  "connection",
  "unknown",
] as const;
export type RoomErrorCode = (typeof ROOM_ERROR_CODES)[number];

export function roomStrings(t: AppT): RoomStrings {
  return {
    title: t("lobby:room.title"),
    description: t("lobby:room.description"),
    create: t("lobby:room.create"),
    quick: t("lobby:room.quick"),
    playCasual: t("lobby:room.playCasual"),
    playRated: t("lobby:room.playRated"),
    finding: t("lobby:room.finding"),
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
    suspendedUntil: t("lobby:room.suspendedUntil", { until: "{until}" }),
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
      accounts_only: t("lobby:errors.accounts_only"),
      rated_guests: t("lobby:errors.rated_guests"),
      suspended: t("lobby:errors.suspended"),
      connection: t("lobby:errors.connection"),
      unknown: t("lobby:errors.unknown"),
    },
    rated: {
      badge: t("lobby:rated.badge", { pool: "{pool}" }),
      pools: {
        bullet: t("lobby:rated.pools.bullet"),
        blitz: t("lobby:rated.pools.blitz"),
        rapid: t("lobby:rated.pools.rapid"),
        classical: t("lobby:rated.pools.classical"),
      },
      checking: t("lobby:rated.checking"),
      change: t("lobby:rated.change", { before: "{before}", after: "{after}", change: "{change}" }),
      review: t("lobby:rated.review"),
      failed: t("lobby:rated.failed"),
      title: t("lobby:rated.title"),
      intro: t("lobby:rated.intro"),
      mode: t("lobby:rated.mode"),
      casual: t("lobby:rated.casual"),
      rated: t("lobby:rated.rated"),
      lobbyHint: t("lobby:rated.lobbyHint"),
      accountsOnly: t("lobby:rated.accountsOnly"),
      signIn: t("lobby:rated.signIn"),
      searching: t("lobby:rated.searching"),
      clock: t("lobby:rated.clock", { clock: "{clock}", pool: "{pool}" }),
      searchingNow: t("lobby:rated.searchingNow", { count: "{count}" }),
      wait: t("lobby:rated.wait", { time: "{time}" }),
      waitUnknown: t("lobby:rated.waitUnknown"),
      range: t("lobby:rated.range", { low: "{low}", high: "{high}" }),
      cancel: t("lobby:rated.cancel"),
      newOpponent: t("lobby:rated.newOpponent"),
      viewGame: t("lobby:rated.viewGame"),
    },
  };
}
