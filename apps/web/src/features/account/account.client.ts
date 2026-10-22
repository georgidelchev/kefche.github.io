// Client behavior for AccountButton.astro (no framework). Shows the cached
// account summary at once, then, when a session is stored, loads supabase-js
// in idle time to refresh the session and the summary.

import { LOCALE_CHANGE_EVENT } from "@/features/i18n/locale-preference";
import { themePreferenceSchema } from "@/features/theme/theme";
import { THEME_CHANGE_EVENT } from "@/features/theme/theme-dom";
import { isLocale } from "@/i18n/locales";
import { getSupabase, hasStoredSession } from "@/lib/supabase/client";
import { AUTH_STORAGE_KEY } from "@/lib/supabase/config";

import { localStorageOrUndefined, renderAccount, setAccount, syncAccount } from "./account-state";
import { ACCOUNT_STORAGE_KEY, readAccountSummary } from "./account-summary";
import { markUnsaved, syncPreferences } from "./preferences-sync";

const whenIdle = (task: () => void) => {
  if ("requestIdleCallback" in window) window.requestIdleCallback(task, { timeout: 3000 });
  else setTimeout(task, 1000);
};

renderAccount(readAccountSummary(localStorageOrUndefined()));
if (hasStoredSession()) {
  whenIdle(() => {
    void getSupabase()?.then(syncAccount);
  });
} else if (document.documentElement.dataset.account) {
  setAccount(null); // stale summary without a session
}

// The user picked a theme or language: save it to their profile (now, or on
// the next page if this one navigates away first).
function saveChoice(change: Parameters<typeof markUnsaved>[1]) {
  const summary = readAccountSummary(localStorageOrUndefined());
  if (!summary) return; // signed out: the choice stays on this device
  markUnsaved(summary.id, change);
  void getSupabase()?.then((supabase) => syncPreferences(supabase, summary.id));
}
document.addEventListener(THEME_CHANGE_EVENT, (event) => {
  const theme = themePreferenceSchema.safeParse((event as CustomEvent<unknown>).detail);
  if (theme.success) saveChoice({ theme: theme.data });
});
document.addEventListener(LOCALE_CHANGE_EVENT, (event) => {
  const locale: unknown = (event as CustomEvent<unknown>).detail;
  if (isLocale(locale)) saveChoice({ locale });
});

// Another tab signed in, signed out or changed the profile.
window.addEventListener("storage", (event) => {
  if (event.key === ACCOUNT_STORAGE_KEY || event.key === null) {
    renderAccount(readAccountSummary(localStorageOrUndefined()));
  } else if (event.key === AUTH_STORAGE_KEY && event.newValue === null) {
    setAccount(null);
  }
});
