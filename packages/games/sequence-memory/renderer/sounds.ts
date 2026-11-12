// Sequence Memory sound effects, from the SDK's synthesized palette: each
// pad its own sound, so a sequence can be followed by ear as well as eye.
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    {
      pad0: "marimba-down",
      pad1: "kalimba-rise",
      pad2: "wood-block",
      pad3: "small-bubble",
      end: "marimba-lose",
    },
    () => context.settings.volume,
  );
