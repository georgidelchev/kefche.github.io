// Words and numbers for finished games on server-rendered pages (the
// profile and a game's own page).
import type { TimerPreset } from "@kefche/game-sdk";

import type { AppT } from "@/i18n/i18n";

import type { MatchPlayer } from "./history";

/** A rating pool's name ("Blitz"); an unknown pool shows its id. */
export function poolName(t: AppT, pool: string): string {
  const names: Record<string, string> = {
    bullet: t("lobby:rated.pools.bullet"),
    blitz: t("lobby:rated.pools.blitz"),
    rapid: t("lobby:rated.pools.rapid"),
    classical: t("lobby:rated.pools.classical"),
  };
  return names[pool] ?? pool;
}

/** "5 min + 3 s · Blitz" for a rated clock, or what there is of it. */
export function clockText(t: AppT, timer: TimerPreset, pool: string | null, bcp47: string) {
  const number = (n: number) => n.toLocaleString(bcp47);
  const clock =
    timer.kind === "clock"
      ? t("games:turn.timerClock", {
          minutes: number(timer.base / 60),
          increment: number(timer.increment),
        })
      : null;
  if (clock && pool) return t("lobby:rated.clock", { clock, pool: poolName(t, pool) });
  return clock ?? (pool ? poolName(t, pool) : "");
}

export type Outcome = "win" | "loss" | "draw";

export const outcomeOf = (points: number): Outcome =>
  points >= 1 ? "win" : points <= 0 ? "loss" : "draw";

export function outcomeText(t: AppT, outcome: Outcome): string {
  switch (outcome) {
    case "win":
      return t("profile:outcome.win");
    case "loss":
      return t("profile:outcome.loss");
    case "draw":
      return t("profile:outcome.draw");
  }
}

/**
 * A seat's name: the nickname, or the bot ("Bot, Medium"). A rated game's
 * players all had accounts, so a seat without one is a deleted account; in
 * an `unrated` game it's "Player n" (a guest, or a second player on one
 * device).
 */
export function playerName(
  t: AppT,
  player: MatchPlayer | undefined,
  unrated?: { bcp47: string },
): string {
  if (player?.nickname) return player.nickname;
  if (player?.bot) {
    const difficulty = {
      easy: t("games:turn.difficulties.easy"),
      medium: t("games:turn.difficulties.medium"),
      hard: t("games:turn.difficulties.hard"),
    }[player.bot];
    return t("games:turn.botBadge", { difficulty });
  }
  if (player && unrated) {
    return t("profile:game.player", { n: (player.seat + 1).toLocaleString(unrated.bcp47) });
  }
  return t("profile:deletedPlayer");
}

/** "m:ss" or "h:mm:ss" (the SDK's formatDuration lives in its browser-only entry). */
export function durationText(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${String(h)}:${String(m).padStart(2, "0")}:${s}` : `${String(m)}:${s}`;
}

/** A result with no win or loss (alone, or in a race): "Score 1,240", else "Time 4:05". */
export function scoreText(t: AppT, player: MatchPlayer, bcp47: string): string | null {
  if (player.score !== null) return t("games:score", { score: player.score.toLocaleString(bcp47) });
  if (player.timeMs !== null) return t("games:time", { time: durationText(player.timeMs) });
  return null;
}

/**
 * How a game ended, in the game's own words (its "ui" strings, as at the
 * board): "Checkmate. AliceR wins." Empty for a reason the game doesn't
 * describe (every game but rated chess, so far).
 */
export function endingText(
  t: AppT,
  ui: Record<string, string>,
  reason: string,
  players: readonly MatchPlayer[],
): string {
  const winner = players.find((p) => p.outcome !== null && p.outcome >= 1);
  const loser = players.find((p) => p.outcome !== null && p.outcome <= 0);
  const say = (key: string, player?: MatchPlayer) =>
    (ui[key] ?? "").replaceAll("{name}", playerName(t, player));
  switch (reason) {
    case "checkmate":
      return say("endCheckmate", winner);
    case "resign":
      return say("endResign", loser);
    case "timeout":
      return winner ? say("endTimeout", loser) : say("endTimeoutDraw");
    case "agreement":
      return say("endAgreement");
    case "stalemate":
      return say("endStalemate");
    case "insufficient":
      return say("endInsufficient");
    case "threefold":
      return say("endThreefold");
    case "fifty-moves":
      return say("endFiftyMoves");
    default:
      return "";
  }
}

/** Time spent playing, in the locale's own units: "45 sec", "12 min", "3.5 hr". */
export function playTimeText(ms: number, bcp47: string): string {
  const unit = (value: number, name: "second" | "minute" | "hour") =>
    new Intl.NumberFormat(bcp47, {
      style: "unit",
      unit: name,
      unitDisplay: "short",
      maximumFractionDigits: name === "hour" ? 1 : 0,
    }).format(value);
  if (ms < 60_000) return unit(Math.floor(ms / 1000), "second");
  if (ms < 3_600_000) return unit(Math.floor(ms / 60_000), "minute");
  return unit(Math.floor(ms / 360_000) / 10, "hour");
}

/** "+12", "−8" (whole points), or null without both ratings. */
export function ratingChange(player: MatchPlayer, bcp47: string): string | null {
  if (player.ratingBefore === null || player.ratingAfter === null) return null;
  return new Intl.NumberFormat(bcp47, { signDisplay: "exceptZero" }).format(
    Math.round(player.ratingAfter) - Math.round(player.ratingBefore),
  );
}
