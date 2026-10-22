// Client behavior for ThemeSwitcher.astro (no framework): every switcher on the
// page, and every open tab, shows and applies the same preference.
import { parseThemePreference, THEME_STORAGE_KEY } from "./theme";
import { currentTheme, setTheme } from "./theme-dom";

document.addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.matches("[data-theme-input]")) return;
  setTheme(parseThemePreference(input.value), { announce: true });
});

// Another tab changed the preference (key null: storage was cleared). That
// tab already saved it, so this one only follows.
window.addEventListener("storage", (event) => {
  if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
  setTheme(currentTheme(), { announce: false });
});

setTheme(currentTheme(), { announce: false });
