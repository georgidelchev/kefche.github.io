// Backgammon sound effects, from the SDK's synthesized palette (Phase 12).
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    {
      roll: "disc-clack",
      move: "wood-block",
      win: "marimba-win",
      lose: "marimba-lose",
      draw: "marimba-even",
    },
    () => context.settings.volume,
  );
