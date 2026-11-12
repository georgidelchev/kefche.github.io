// Tap Frenzy sound effects, from the SDK's synthesized palette.
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    { tap: "felt-tap", win: "kalimba-win", lose: "marimba-lose" },
    () => context.settings.volume,
  );
