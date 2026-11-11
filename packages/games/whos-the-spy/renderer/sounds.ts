// Who's the Spy sound effects, from the SDK's synthesized palette (Phase 12).
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    {
      ready: "felt-tap",
      vote: "wood-block",
      win: "harp-win",
      lose: "marimba-lose",
      draw: "marimba-even",
    },
    () => context.settings.volume,
  );
