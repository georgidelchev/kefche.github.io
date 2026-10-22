// Client behavior for AccountButton.astro (no framework). Shows the cached
// account summary at once, then, when a session is stored, loads supabase-js
// in idle time to refresh the session and the summary.
import { getSupabase, hasStoredSession } from "@/lib/supabase/client";
import { AUTH_STORAGE_KEY } from "@/lib/supabase/config";

import { localStorageOrUndefined, renderAccount, setAccount, syncAccount } from "./account-state";
import { ACCOUNT_STORAGE_KEY, readAccountSummary } from "./account-summary";

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

// Another tab signed in, signed out or changed the profile.
window.addEventListener("storage", (event) => {
  if (event.key === ACCOUNT_STORAGE_KEY || event.key === null) {
    renderAccount(readAccountSummary(localStorageOrUndefined()));
  } else if (event.key === AUTH_STORAGE_KEY && event.newValue === null) {
    setAccount(null);
  }
});
