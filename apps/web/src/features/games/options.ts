// A game's options (manifest `options`): Sudoku's difficulty in a race,
// Checkers' variant in a turn game's setup or room. The chosen values form
// the engine config, which the server checks the same way (submit-match).
import type { GameManifest } from "@kefche/game-sdk";

export type OptionValue = string | number | boolean;
/** Chosen values by option key. */
export type OptionValues = Record<string, OptionValue>;

/** An option with its labels in the page's language (from the game's "ui" strings). */
export interface GameOptionView {
  key: string;
  legend: string;
  /** The first is the default. */
  values: { value: OptionValue; label: string }[];
  /** Shown in rooms and setups; when not, they play the first value. */
  inRooms: boolean;
}

export const gameOptions = (manifest: GameManifest, ui: Record<string, string>): GameOptionView[] =>
  (manifest.options ?? []).map((option) => ({
    key: option.key,
    legend: ui[option.label] ?? option.label,
    values: option.values.map((v) => ({ value: v.value, label: ui[v.label] ?? v.label })),
    inRooms: option.rooms !== false,
  }));

/** The engine config: every option's chosen value, or its default. Undefined without options. */
export function optionsConfig(
  options: readonly GameOptionView[],
  values: OptionValues,
): OptionValues | undefined {
  if (options.length === 0) return undefined;
  return Object.fromEntries(
    options.flatMap((option) => {
      const chosen = values[option.key];
      const value = option.values.some((v) => v.value === chosen)
        ? chosen
        : option.values[0]?.value;
      return value === undefined ? [] : [[option.key, value]];
    }),
  );
}
