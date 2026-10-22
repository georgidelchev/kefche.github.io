// Applies a theme preference to this page: storage, <html data-theme> and
// every switcher. Shared by the switcher, the settings page and account sync.
import {
  applyThemePreference,
  readStoredTheme,
  writeStoredTheme,
  type KeyValueStorage,
  type ThemePreference,
} from "./theme";

/** Dispatched on `document` when the user picks a theme (detail: ThemePreference). */
export const THEME_CHANGE_EVENT = "kefche:themechange";

function localStorageOrUndefined(): KeyValueStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export const currentTheme = (): ThemePreference => readStoredTheme(localStorageOrUndefined());

/**
 * Stores and applies `preference`. `announce` marks a user's own choice, which
 * account sync saves to their profile; values loaded from the profile don't.
 */
export function setTheme(preference: ThemePreference, { announce }: { announce: boolean }): void {
  writeStoredTheme(localStorageOrUndefined(), preference);
  applyThemePreference(document.documentElement, preference);
  for (const input of document.querySelectorAll<HTMLInputElement>("input[data-theme-input]")) {
    input.checked = input.value === preference;
  }
  if (announce) document.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: preference }));
}
