// Reaction Flash sound effects, from the SDK's synthesized palette. There's
// no sound when the pad turns green: the game measures how fast you see it.
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(
    { hit: "felt-tap", early: "wood-thunk", win: "harp-win", lose: "marimba-lose" },
    () => context.settings.volume,
  );
