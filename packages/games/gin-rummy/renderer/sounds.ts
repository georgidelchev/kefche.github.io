// Gin Rummy sound effects, from the SDK's synthesized palette (Phase 12).
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    {
      draw_: "swish",
      discard: "felt-tap",
      knock: "wood-block",
      gin: "kalimba-rise",
      win: "harp-win",
      lose: "marimba-lose",
      draw: "marimba-even",
    },
    () => context.settings.volume,
  );
