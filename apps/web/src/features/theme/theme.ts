// zod/mini: same validation, tree-shakable (this module ships to the browser).
import * as z from "zod/mini";

/** localStorage key; also read by the inline no-flash script in ThemeScript.astro. */
export const THEME_STORAGE_KEY = "kefche:theme";

export const themePreferenceSchema = z.enum(["light", "dark", "system"]);
export type ThemePreference = z.infer<typeof themePreferenceSchema>;

/** Minimal Storage surface, injectable for tests and non-browser environments. */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Any unknown or corrupted value falls back to "system" (SPEC §6.3 default). */
export function parseThemePreference(raw: unknown): ThemePreference {
  const result = themePreferenceSchema.safeParse(raw);
  return result.success ? result.data : "system";
}

/** "system" removes the attribute so `prefers-color-scheme` decides (see tokens.css). */
export function applyThemePreference(root: HTMLElement, preference: ThemePreference): void {
  if (preference === "system") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = preference;
  }
}

// Storage can throw (privacy modes, disabled cookies); theme is a convenience, never fatal.
export function readStoredTheme(storage: KeyValueStorage | undefined): ThemePreference {
  try {
    return parseThemePreference(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function writeStoredTheme(
  storage: KeyValueStorage | undefined,
  preference: ThemePreference,
): void {
  try {
    if (preference === "system") {
      storage?.removeItem(THEME_STORAGE_KEY);
    } else {
      storage?.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // Not persisted; the choice still applies to this page view.
  }
}
