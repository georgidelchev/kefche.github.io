// Sudoku sound effects (Kenney, CC0; see CREDITS.md). Vite turns each
// new URL(…, import.meta.url) into a hashed asset URL.
import { createSoundService, type GameContext } from "@kefche/game-sdk/browser";

const SOURCES = {
  place: [new URL("../assets/sounds/place.mp3", import.meta.url).href],
  note: [new URL("../assets/sounds/note.mp3", import.meta.url).href],
  erase: [new URL("../assets/sounds/erase.mp3", import.meta.url).href],
  mistake: [new URL("../assets/sounds/mistake.mp3", import.meta.url).href],
  hint: [new URL("../assets/sounds/hint.mp3", import.meta.url).href],
  win: [new URL("../assets/sounds/win.mp3", import.meta.url).href],
};

export type Sounds = ReturnType<typeof createSounds>;

export const createSounds = (context: GameContext) =>
  createSoundService(SOURCES, () => context.settings.volume);
