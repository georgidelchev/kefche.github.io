// Sounds and haptics for a turn game's moves and its end, once per move:
// re-renders, undo and a remount stay quiet.
import { useEffect, useEffectEvent, useRef } from "react";

import { yourSeat, type GameContext, type MatchSetup } from "../browser/game-module";
import { HAPTICS, vibrate } from "../browser/haptics";

import type { TurnView } from "../browser/turn-session";
import type { GameResult } from "../engines";

export type Outcome = "win" | "lose" | "draw";

/**
 * How the end sounds to this browser: a draw when everyone drew, a loss when
 * "you" (yourSeat) didn't win, otherwise a win (on one shared device, the end
 * is a celebration).
 */
export function outcomeFor(result: GameResult, match: MatchSetup | undefined): Outcome {
  const outcome = result.outcome ?? [];
  if (outcome.length > 0 && outcome.every((o) => o === 0.5)) return "draw";
  const you = yourSeat(match);
  return you >= 0 && outcome[you] !== 1 ? "lose" : "win";
}

/**
 * Calls onMove for each new move (moves, the game's move count, went up),
 * with a tap when a person made it; at the end, plays the outcome's sound and
 * haptic instead.
 */
export function useTurnFeedback<State, Action>({
  context,
  view,
  moves,
  sounds,
  onMove,
}: {
  context: GameContext;
  view: TurnView<State, Action> | null;
  moves: number;
  sounds: { play(name: Outcome): void };
  onMove?: (view: TurnView<State, Action>) => void;
}): void {
  const heard = useRef(0);
  const react = useEffectEvent((current: TurnView<State, Action>) => {
    const { haptics } = context.settings;
    const mover = current.lastMove?.seat;
    if (mover !== undefined && context.match?.seats[mover]?.kind === "human") {
      vibrate(HAPTICS.tap, haptics);
    }
    if (!current.result) {
      onMove?.(current);
      return;
    }
    const outcome = outcomeFor(current.result, context.match);
    sounds.play(outcome);
    if (outcome !== "draw") vibrate(outcome === "win" ? HAPTICS.win : HAPTICS.lose, haptics);
  });
  useEffect(() => {
    if (!view) return;
    const fresh = moves > heard.current;
    heard.current = moves;
    if (fresh) react(view);
  }, [view, moves]);
}
