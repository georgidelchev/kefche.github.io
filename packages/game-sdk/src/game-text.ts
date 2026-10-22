// Shape of a game's translations, packages/games/<id>/i18n/<locale>.json:
// catalog text, the SEO sections of the game page (SPEC §15) and the game's
// own UI strings. Validated at build time by the registry.

export interface GameText {
  /** Display name, e.g. "Sudoku". */
  name: string;
  /** One line for catalog cards. */
  tagline: string;
  /** Meta description, about 150 characters. */
  description: string;
  /** "About" section paragraphs. */
  about: string[];
  howToPlay: string[];
  controls: string[];
  tips: string[];
  faq: { question: string; answer: string }[];
  /** Strings the game itself shows, read with `context.t(key)`. */
  ui: Record<string, string>;
}
