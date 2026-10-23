// Props for the game islands, built on the server from the manifest and the
// page's translations: the game page and the online room page share them.
import type { GameManifest } from "@kefche/game-sdk";

import type { AppT } from "@/i18n/i18n";
import { getSupabaseEnv } from "@/lib/env";

import { BOT_NAME_KEYS } from "./catalog";

import type { PlayerStrings } from "./GamePlayer";
import type { TurnStrings } from "./turn/labels";
import type { TurnConfig, TurnMode } from "./turn/match-setup";

export function playerStrings(t: AppT): PlayerStrings {
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
  };
}

/** What a turn-based game's setup offers, or null for other games. */
export function turnConfig(manifest: GameManifest): TurnConfig | null {
  if (manifest.kind !== "turn") return null;
  return {
    modes: manifest.modes.filter((m): m is TurnMode => m === "solo-bots" || m === "hotseat"),
    players: manifest.players,
    difficulties: manifest.bots.supported ? manifest.bots.difficulties : [],
    timers: manifest.timers,
  };
}

/** Online rooms need a turn-based game that offers them, in a build with Supabase. */
export const playsOnline = (manifest: GameManifest): boolean =>
  manifest.kind === "turn" &&
  manifest.modes.includes("online-private") &&
  getSupabaseEnv() !== null;

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
    botNames: Object.fromEntries(
      Object.entries(BOT_NAME_KEYS).map(([id, key]) => [id, t(key)]),
    ) as TurnStrings["botNames"],
  };
}
