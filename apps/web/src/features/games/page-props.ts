// Props for the game islands, built on the server from the manifest and the
// page's translations: the game page and the online room page share them.
import { getRelativeLocaleUrl } from "astro:i18n";

import { GLOBAL_ACHIEVEMENTS, type GameManifest, type GameText } from "@kefche/game-sdk";

import { frameNames } from "@/features/account/frames";
import { authStrings } from "@/features/auth/strings";
import { guestStrings, type GuestStrings } from "@/features/lobby/strings";
import type { AppT } from "@/i18n/i18n";
import type { Locale } from "@/i18n/locales";
import { getArenaUrl, getSupabaseEnv } from "@/lib/env";

import { BOT_NAME_KEYS } from "./catalog";
import { hasRooms, racesInRooms } from "./game-names";
import { gameOptions, type GameOptionView } from "./options";

import type { PlayerStrings } from "./GamePlayer";
import type { ResultsStrings } from "./GameResults";
import type { TurnStrings } from "./turn/labels";
import type { TurnConfig, TurnMode } from "./turn/match-setup";

export function playerStrings(
  t: AppT,
  locale: Locale,
  game: { manifest: GameManifest; text: GameText },
): PlayerStrings {
  return {
    play: t("games:play"),
    loading: t("games:loading"),
    loadFailed: t("games:loadFailed"),
    retry: t("games:retry"),
    pause: t("games:pause"),
    paused: t("games:paused"),
    resume: t("games:resume"),
    restart: t("games:restart"),
    exit: t("games:exit"),
    mute: t("games:mute"),
    unmute: t("games:unmute"),
    won: t("games:won"),
    gameOver: t("games:gameOver"),
    // Placeholders survive here and are filled by the player.
    score: t("games:score", { score: "{score}" }),
    time: t("games:time", { time: "{time}" }),
    playAgain: t("games:playAgain"),
    daily: t("games:daily.play"),
    results: resultsStrings(t, locale, game),
  };
}

/** The site-wide achievements' names (literal keys, for i18n:check). */
function globalAchievementName(t: AppT, id: string): string {
  switch (id) {
    case "regular":
      return t("profile:achievements.regular.name");
    case "explorer":
      return t("profile:achievements.explorer.name");
    case "rising-star":
      return t("profile:achievements.risingStar.name");
    default:
      return id;
  }
}

/** The results screen's text, with the game's achievements and the site-wide ones. */
function resultsStrings(
  t: AppT,
  locale: Locale,
  { manifest, text }: { manifest: GameManifest; text: GameText },
): ResultsStrings {
  return {
    best: t("games:results.best", { value: "{value}" }),
    newBest: t("games:results.newBest"),
    xp: t("games:results.xp", { xp: "{xp}" }),
    level: t("games:results.level", { level: "{level}" }),
    levelUp: t("games:results.levelUp", { level: "{level}" }),
    xpToNext: t("games:results.xpToNext", { into: "{into}", span: "{span}", next: "{next}" }),
    place: t("games:results.place", { board: "{board}", all: "{all}", week: "{week}" }),
    dailyPlace: t("games:results.dailyPlace", { rank: "{rank}" }),
    streak: t("games:results.streak", { days: "{days}" }),
    newFrame: t("games:results.newFrame", { frame: "{frame}" }),
    frameNames: frameNames(t),
    boards: Object.fromEntries([
      // The daily challenge's board (a game played as the day's challenge goes on it).
      [
        `daily.${manifest.id}`,
        {
          name: t("leaderboards:daily"),
          href: `${getRelativeLocaleUrl(locale, "/leaderboards/")}?board=daily`,
        },
      ],
      ...manifest.leaderboards.map((b): [string, { name: string; href: string }] => {
        const id = `${manifest.id}.${b.id}`;
        return [
          id,
          {
            name: text.leaderboards[b.id] ?? b.id,
            href: `${getRelativeLocaleUrl(locale, "/leaderboards/")}?board=${encodeURIComponent(id)}`,
          },
        ];
      }),
    ]),
    achievements: t("games:results.achievements"),
    unlocked: t("games:results.unlocked"),
    saving: t("games:results.saving"),
    guest: t("games:results.guest"),
    signIn: t("games:results.signIn"),
    signInHref: getRelativeLocaleUrl(locale, "/auth/sign-in/"),
    share: t("games:results.share"),
    copied: t("games:results.copied"),
    shareText: t("games:results.shareText", { result: "{result}", game: "{game}" }),
    notifications: t("common:notifications.label"),
    close: t("common:actions.close"),
    tiers: {
      bronze: t("profile:tier.bronze"),
      silver: t("profile:tier.silver"),
      gold: t("profile:tier.gold"),
    },
    achievementNames: Object.fromEntries([
      ...manifest.achievements.map((a): AchievementName => [
        `${manifest.id}.${a.id}`,
        { name: text.achievements[a.id]?.name ?? a.id, icon: a.icon },
      ]),
      ...GLOBAL_ACHIEVEMENTS.map((a): AchievementName => [
        `global.${a.id}`,
        { name: globalAchievementName(t, a.id), icon: a.icon },
      ]),
    ]),
  };
}

type AchievementName = [string, ResultsStrings["achievementNames"][string]];

/** What a turn-based game's setup offers, or null for other games. */
export function turnConfig(manifest: GameManifest, ui: Record<string, string>): TurnConfig | null {
  if (manifest.kind !== "turn") return null;
  return {
    options: gameOptions(manifest, ui),
    modes: manifest.modes.filter((m): m is TurnMode => m === "solo-bots" || m === "hotseat"),
    players: manifest.players,
    difficulties: manifest.bots.supported ? manifest.bots.difficulties : [],
    ...(manifest.bots.supported && manifest.bots.levels ? { levels: manifest.bots.levels } : {}),
    timers: manifest.timers,
    onlineTimers: onlineTimers(manifest),
  };
}

/**
 * The timers an online room may use (only clocks when an away player's clock
 * runs on), the one a new room starts with first.
 */
function onlineTimers(manifest: GameManifest): number[] {
  const allowed = manifest.timers.flatMap((preset, i) =>
    manifest.awayPlayers === "clock" && preset.kind !== "clock" ? [] : [i],
  );
  const first = manifest.onlineTimer;
  return first !== undefined && allowed.includes(first)
    ? [first, ...allowed.filter((i) => i !== first)]
    : allowed;
}

/**
 * What a room offers for a game: a turn game's setup, or a race's (people
 * only, from two seats; the manifest's countdowns are the time limits).
 */
export function roomConfig(manifest: GameManifest, ui: Record<string, string>): TurnConfig | null {
  if (manifest.kind === "turn") return turnConfig(manifest, ui);
  if (!racesInRooms(manifest)) return null;
  const min = Math.max(2, manifest.players.min);
  return {
    modes: [],
    players: { min, max: manifest.players.max, default: Math.max(min, manifest.players.default) },
    difficulties: [],
    options: gameOptions(manifest, ui),
    timers: manifest.timers,
    onlineTimers: onlineTimers(manifest),
  };
}

/** Online rooms need a turn-based or race game that offers them, in a build with Supabase. */
export const playsOnline = (manifest: GameManifest): boolean =>
  hasRooms(manifest) && getSupabaseEnv() !== null;

/** A race game's room setup: its options, and how players rank. */
export interface RaceSetup {
  options: GameOptionView[];
  /** "time": solving first wins (Sudoku); "score": the highest score wins. */
  ranking: "score" | "time";
}

export function raceSetup(manifest: GameManifest, ui: Record<string, string>): RaceSetup | null {
  if (!racesInRooms(manifest)) return null;
  return {
    options: gameOptions(manifest, ui),
    ranking: manifest.leaderboards[0]?.metric === "time" ? "time" : "score",
  };
}

/** Which online modes a game that plays online offers beyond invite-only rooms. */
export const onlineModes = (manifest: GameManifest): { public: boolean; quick: boolean } => ({
  public: manifest.modes.includes("online-public"),
  quick: manifest.modes.includes("quick-match"),
});

/** A rated clock (an index into the manifest's timers) in its pool. */
export interface RatedClock {
  timer: number;
  pool: string;
}

/** The clocks rated matchmaking offers, pool by pool (none for an unrated game). */
export const ratedClocks = (manifest: GameManifest): RatedClock[] =>
  manifest.rated
    ? manifest.rated.pools.flatMap((pool) => pool.timers.map((timer) => ({ timer, pool: pool.id })))
    : [];

/**
 * A game's UI strings as its player gets them: its own, plus the kit's
 * shared ones it uses (keys "kit.…"), so every card game names cards (and
 * every dice game dice) the same way without carrying the words itself
 * (Phase 12): games tagged "cards" or "dice".
 */
export function playerUi(manifest: GameManifest, ui: Record<string, string>, t: AppT) {
  return {
    ...(manifest.tags.includes("cards") ? cardKitUi(t) : {}),
    ...(manifest.tags.includes("dice") ? diceKitUi(t) : {}),
    ...ui,
  };
}

/** The dice kit's strings (@kefche/game-sdk/react diceText). */
export function diceKitUi(t: AppT): Record<string, string> {
  return {
    "kit.die.showing": t("games:dice.showing", { value: "{value}" }),
    "kit.die.unrolled": t("games:dice.unrolled"),
  };
}

/** The card kit's strings (@kefche/game-sdk/react cardText), keyed as games ask for them. */
export function cardKitUi(t: AppT): Record<string, string> {
  return {
    "kit.card.clubs": t("games:cards.clubs"),
    "kit.card.diamonds": t("games:cards.diamonds"),
    "kit.card.hearts": t("games:cards.hearts"),
    "kit.card.spades": t("games:cards.spades"),
    "kit.card.jack": t("games:cards.jack"),
    "kit.card.queen": t("games:cards.queen"),
    "kit.card.king": t("games:cards.king"),
    "kit.card.ace": t("games:cards.ace"),
    "kit.card.name": t("games:cards.name", { rank: "{rank}", suit: "{suit}" }),
    "kit.card.faceDown": t("games:cards.faceDown"),
    "kit.card.fourColour": t("games:cards.fourColour"),
  };
}

export function turnStrings(t: AppT): TurnStrings {
  return {
    start: { "solo-bots": t("games:turn.start.soloBots"), hotseat: t("games:turn.start.hotseat") },
    setupTitle: {
      "solo-bots": t("games:turn.setupTitle.soloBots"),
      hotseat: t("games:turn.setupTitle.hotseat"),
    },
    players: t("games:turn.players"),
    player: t("games:turn.player", { n: "{n}" }),
    you: t("games:turn.you"),
    person: t("games:turn.person"),
    bot: t("games:turn.bot"),
    difficulty: t("games:turn.difficulty"),
    custom: t("games:turn.custom"),
    level: t("games:turn.level", { level: "{level}" }),
    difficulties: {
      easy: t("games:turn.difficulties.easy"),
      medium: t("games:turn.difficulties.medium"),
      hard: t("games:turn.difficulties.hard"),
    },
    timer: t("games:turn.timer"),
    timerNone: t("games:turn.timerNone"),
    timerPerMove: t("games:turn.timerPerMove", { seconds: "{seconds}" }),
    timerClock: t("games:turn.timerClock", { minutes: "{minutes}", increment: "{increment}" }),
    begin: t("games:turn.begin"),
    changeSetup: t("games:turn.changeSetup"),
    botBadge: t("games:turn.botBadge", { difficulty: "{difficulty}" }),
    toMove: t("games:turn.toMove", { name: "{name}" }),
    thinking: t("games:turn.thinking", { name: "{name}" }),
    clockLabel: t("games:turn.clockLabel", { name: "{name}", time: "{time}" }),
    wins: t("games:turn.wins", { name: "{name}" }),
    winners: t("games:turn.winners", { names: "{names}" }),
    youWin: t("games:turn.youWin"),
    youLose: t("games:turn.youLose"),
    draw: t("games:turn.draw"),
    outOfTime: t("games:turn.outOfTime", { name: "{name}" }),
    handoffTitle: t("games:turn.handoffTitle", { name: "{name}" }),
    handoffBody: t("games:turn.handoffBody", { name: "{name}" }),
    handoffReady: t("games:turn.handoffReady", { name: "{name}" }),
    botNames: Object.fromEntries(
      Object.entries(BOT_NAME_KEYS).map(([id, key]) => [id, t(key)]),
    ) as TurnStrings["botNames"],
  };
}

/** What a real-time game's player needs for the online arena. */
export interface ArenaProps {
  url: string;
  /** The guest's name form, shown before a guest's first online game. */
  guest: GuestStrings;
  /** Declining the name form (back to the game's mode screen). */
  cancel: string;
  privacy: string;
}

/**
 * Where a game with hidden information plays online: a table on the arena
 * server (Phase 12, ADR-0047). Null for other games; a null URL when this
 * build has no arena server.
 */
export const tableAccess = (manifest: GameManifest): { url: string | null } | null =>
  manifest.kind === "turn" && manifest.hiddenInformation ? { url: getArenaUrl() } : null;

/** The online arena for a real-time game, in a build with Supabase and an arena server. */
export function arenaProps(manifest: GameManifest, t: AppT, locale: Locale): ArenaProps | null {
  const url = getArenaUrl();
  if (manifest.kind !== "realtime" || url === null || getSupabaseEnv() === null) return null;
  return {
    url,
    guest: guestStrings(t, authStrings(t).errors),
    cancel: t("games:arenaCancel"),
    privacy: getRelativeLocaleUrl(locale, "/privacy/"),
  };
}
