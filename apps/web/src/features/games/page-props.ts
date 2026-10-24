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

/** A race game played in a room (manifest mode "race"). */
const races = (manifest: GameManifest) =>
  manifest.kind === "race" && manifest.modes.includes("race");

/**
 * What a room offers for a game: a turn game's setup, or a race's (people
 * only, from two seats; the manifest's countdowns are the time limits).
 */
export function roomConfig(manifest: GameManifest): TurnConfig | null {
  if (manifest.kind === "turn") return turnConfig(manifest);
  if (!races(manifest)) return null;
  const min = Math.max(2, manifest.players.min);
  return {
    modes: [],
    players: { min, max: manifest.players.max, default: Math.max(min, manifest.players.default) },
    difficulties: [],
    timers: manifest.timers,
    onlineTimers: onlineTimers(manifest),
  };
}

/** Online rooms need a turn-based or race game that offers them, in a build with Supabase. */
export const playsOnline = (manifest: GameManifest): boolean =>
  (manifest.kind === "turn" || races(manifest)) &&
  manifest.modes.includes("online-private") &&
  getSupabaseEnv() !== null;

/** A race option with its labels in the page's language (from the game's "ui" strings). */
export interface RaceOptionView {
  key: string;
  legend: string;
  values: { value: string | number | boolean; label: string }[];
}

/** A race game's room setup: its options, and how players rank. */
export interface RaceSetup {
  options: RaceOptionView[];
  /** "time": solving first wins (Sudoku); "score": the highest score wins. */
  ranking: "score" | "time";
}

export function raceSetup(manifest: GameManifest, ui: Record<string, string>): RaceSetup | null {
  if (!races(manifest)) return null;
  return {
    options: (manifest.raceOptions ?? []).map((option) => ({
      key: option.key,
      legend: ui[option.label] ?? option.label,
      values: option.values.map((v) => ({ value: v.value, label: ui[v.label] ?? v.label })),
    })),
    ranking: manifest.leaderboards[0]?.metric === "time" ? "time" : "score",
  };
}

/** Which online modes a game that plays online offers beyond invite-only rooms. */
export const onlineModes = (manifest: GameManifest): { public: boolean; quick: boolean } => ({
  public: manifest.modes.includes("online-public"),
  quick: manifest.modes.includes("quick-match"),
});

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
    botNames: Object.fromEntries(
      Object.entries(BOT_NAME_KEYS).map(([id, key]) => [id, t(key)]),
    ) as TurnStrings["botNames"],
  };
}
