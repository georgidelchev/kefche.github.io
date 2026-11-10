// Checkers sound effects, from the SDK's synthesized palette (Phase 11 Q5:
// chosen from the existing palette).
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    {
      move: "wood-block",
      capture: "wood-thunk",
      win: "marimba-win",
      lose: "marimba-lose",
      draw: "marimba-even",
    },
    () => context.settings.volume,
  );
