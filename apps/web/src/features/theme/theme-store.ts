import { create } from "zustand";

import {
  applyThemePreference,
  readStoredTheme,
  THEME_STORAGE_KEY,
  writeStoredTheme,
  type KeyValueStorage,
  type ThemePreference,
} from "./theme";

interface ThemeState {
  preference: ThemePreference;
  /** User choice: persist, apply to <html>, update every subscribed island. */
  setPreference: (preference: ThemePreference) => void;
  /** Pull the stored value after hydration (server HTML always renders "system"). */
  syncFromStorage: () => void;
}

function localStorageOrUndefined(): KeyValueStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

// Module-level store: all islands on a page share one instance, so every
// theme switcher stays in sync.
export const useThemeStore = create<ThemeState>()((set) => ({
  preference: "system",
  setPreference: (preference) => {
    writeStoredTheme(localStorageOrUndefined(), preference);
    applyThemePreference(document.documentElement, preference);
    set({ preference });
  },
  syncFromStorage: () => {
    set({ preference: readStoredTheme(localStorageOrUndefined()) });
  },
}));

/** Keeps other tabs in sync when the preference changes elsewhere. Returns an unsubscribe function. */
export function subscribeToOtherTabs(): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    const preference = readStoredTheme(localStorageOrUndefined());
    applyThemePreference(document.documentElement, preference);
    useThemeStore.setState({ preference });
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("storage", onStorage);
  };
}
