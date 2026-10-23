// Text for turn-based games: translated on the page (GamePage.astro) and
// passed to the player island, which fills in the {placeholders}.
import type { BotDifficulty, GameResult, Seat, TimerPreset } from "@kefche/game-sdk";

import type { BotNames, TurnMode } from "./match-setup";

export interface TurnStrings {
  start: Record<TurnMode, string>;
  setupTitle: Record<TurnMode, string>;
  players: string;
  /** "Player {n}" */
  player: string;
  you: string;
  person: string;
  bot: string;
  difficulty: string;
  difficulties: Record<BotDifficulty, string>;
  timer: string;
  timerNone: string;
  /** "{seconds} s per move" */
  timerPerMove: string;
  /** "{minutes} min + {increment} s" */
  timerClock: string;
  begin: string;
  changeSetup: string;
  /** "Bot, {difficulty}" */
  botBadge: string;
  /** "{name} to move" */
  toMove: string;
  /** "{name} is thinking" */
  thinking: string;
  /** "{name}: {time} left" */
  clockLabel: string;
  /** "{name} wins!" */
  wins: string;
  /** "Winners: {names}" */
  winners: string;
  youWin: string;
  youLose: string;
  draw: string;
  /** "{name} ran out of time" */
  outOfTime: string;
  botNames: BotNames;
}

export const fill = (template: string, values: Record<string, string | number> = {}) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );

export function timerLabel(preset: TimerPreset, s: TurnStrings, locale: string): string {
  const number = (n: number) => n.toLocaleString(locale);
  switch (preset.kind) {
    case "none":
      return s.timerNone;
    case "per-move":
      return fill(s.timerPerMove, { seconds: number(preset.seconds) });
    case "clock":
      return fill(s.timerClock, {
        minutes: number(preset.base / 60),
        increment: number(preset.increment),
      });
    case "countdown":
      return fill(s.timerPerMove, { seconds: number(preset.seconds) });
  }
}

export const seatName = (seat: Seat, s: TurnStrings): string =>
  seat.kind === "bot" ? s.botNames[seat.nameId] : seat.name;

/** "m:ss", or "s.t" in the last ten seconds. */
export function formatClock(ms: number): string {
  if (ms < 10_000) return (Math.max(0, ms) / 1000).toFixed(1);
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60))}:${String(total % 60).padStart(2, "0")}`;
}

/** The results headline for a finished match. */
export function resultText(
  result: GameResult,
  seats: readonly Seat[],
  mode: TurnMode,
  s: TurnStrings,
  locale: string,
): string {
  const outcome = result.outcome ?? [];
  const best = Math.max(...outcome);
  const winners = seats.filter((_, i) => outcome[i] === best);
  if (winners.length === seats.length) return s.draw;
  if (mode === "solo-bots") {
    const you = seats.findIndex((seat) => seat.kind === "human");
    return outcome[you] === best ? s.youWin : s.youLose;
  }
  const names = winners.map((seat) => seatName(seat, s));
  return names.length === 1
    ? fill(s.wins, { name: names[0] ?? "" })
    : fill(s.winners, {
        names: new Intl.ListFormat(locale, { type: "conjunction" }).format(names),
      });
}
