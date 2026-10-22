// 2048 sound effects (Kenney, CC0; see CREDITS.md). Vite turns each
// new URL(…, import.meta.url) into a hashed asset URL.
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

const SOURCES = {
  move: [new URL("../assets/sounds/move.mp3", import.meta.url).href],
  merge: [new URL("../assets/sounds/merge.mp3", import.meta.url).href],
  undo: [new URL("../assets/sounds/undo.mp3", import.meta.url).href],
  win: [new URL("../assets/sounds/win.mp3", import.meta.url).href],
  lose: [new URL("../assets/sounds/lose.mp3", import.meta.url).href],
};

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(SOURCES, () => context.settings.volume);
