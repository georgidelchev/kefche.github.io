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

export const playerName = (t: AppT, player: MatchPlayer | undefined): string =>
  player?.nickname ?? t("profile:deletedPlayer");

/**
 * How a game ended, in the game's own words (its "ui" strings, as at the
 * board): "Checkmate. AliceR wins." Empty for a reason the game doesn't
 * describe. Phase 6 stores chess; other games' endings come with Phase 7.
 */
export function endingText(
  t: AppT,
  ui: Record<string, string>,
  reason: string,
  players: readonly MatchPlayer[],
): string {
  const winner = players.find((p) => p.outcome >= 1);
  const loser = players.find((p) => p.outcome <= 0);
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

/** "+12", "−8" (whole points), or null without both ratings. */
export function ratingChange(player: MatchPlayer, bcp47: string): string | null {
  if (player.ratingBefore === null || player.ratingAfter === null) return null;
  return new Intl.NumberFormat(bcp47, { signDisplay: "exceptZero" }).format(
    Math.round(player.ratingAfter) - Math.round(player.ratingBefore),
  );
}
