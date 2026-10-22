// Client behavior for ThemeSwitcher.astro (no framework): every switcher on the
// page, and every open tab, shows and applies the same preference.
import {
  applyThemePreference,
  parseThemePreference,
  readStoredTheme,
  THEME_STORAGE_KEY,
  writeStoredTheme,
  type KeyValueStorage,
  type ThemePreference,
} from "./theme";

function localStorageOrUndefined(): KeyValueStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function reflect(preference: ThemePreference): void {
  for (const input of document.querySelectorAll<HTMLInputElement>("input[data-theme-input]")) {
    input.checked = input.value === preference;
  }
}

document.addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.matches("[data-theme-input]")) return;
  const preference = parseThemePreference(input.value);
  writeStoredTheme(localStorageOrUndefined(), preference);
  applyThemePreference(document.documentElement, preference);
  reflect(preference);
});

// Another tab changed the preference (key null: storage was cleared).
window.addEventListener("storage", (event) => {
  if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
  const preference = readStoredTheme(localStorageOrUndefined());
  applyThemePreference(document.documentElement, preference);
  reflect(preference);
});

reflect(readStoredTheme(localStorageOrUndefined()));
