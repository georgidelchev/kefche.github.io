// Client behavior for AccountButton.astro (no framework). Shows the cached
// account summary at once, then, when a session is stored, loads supabase-js
// in idle time to refresh the session and the summary.
import { initialsFor, paletteIndexFor } from "@kefche/ui/lib/avatar";

import { getSupabase, hasStoredSession, type Supabase } from "@/lib/supabase/client";
import { AUTH_STORAGE_KEY } from "@/lib/supabase/config";

import {
  ACCOUNT_STORAGE_KEY,
  readAccountSummary,
  writeAccountSummary,
  type AccountSummary,
  type KeyValueStorage,
} from "./account-summary";

function localStorageOrUndefined(): KeyValueStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function render(summary: AccountSummary | null): void {
  const root = document.documentElement;
  if (!summary) {
    delete root.dataset.account;
    return;
  }
  root.dataset.account = "signed-in";
  const slot = String(paletteIndexFor(summary.id));
  const initials = summary.nickname ? initialsFor(summary.nickname, root.lang) : "";
  for (const avatar of document.querySelectorAll<HTMLElement>("[data-account-avatar]")) {
    avatar.style.backgroundColor = `var(--player-${slot})`;
    avatar.style.color = `var(--player-${slot}-ink)`;
    // The URL was validated by the summary schema (no quotes or parentheses).
    avatar.style.backgroundImage = summary.avatarUrl ? `url("${summary.avatarUrl}")` : "";
    const hasPicture = summary.avatarUrl !== null;
    const label = avatar.querySelector("[data-account-initials]");
    if (label) label.textContent = hasPicture ? "" : initials;
    avatar
      .querySelector("[data-account-icon]")
      ?.toggleAttribute("hidden", hasPicture || initials !== "");
  }
}

function update(summary: AccountSummary | null): void {
  writeAccountSummary(localStorageOrUndefined(), summary);
  render(summary);
}

/**
 * Re-reads the session and profile and updates the cached summary and the
 * header. Guests (anonymous sessions) count as signed out here: they see
 * "Sign in". Call after any sign-in, sign-out or profile change.
 */
export async function syncAccount(supabase: Supabase): Promise<AccountSummary | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return readAccountSummary(localStorageOrUndefined()); // offline: keep the cache
  const user = data.session?.user;
  if (!user || user.is_anonymous === true) {
    update(null);
    return null;
  }
  const profile = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .maybeSingle();
  if (profile.error) return readAccountSummary(localStorageOrUndefined());
  const summary: AccountSummary = {
    id: user.id,
    nickname: profile.data?.nickname ?? null,
    avatarUrl: null,
  };
  update(summary);
  return summary;
}

const whenIdle = (task: () => void) => {
  if ("requestIdleCallback" in window) window.requestIdleCallback(task, { timeout: 3000 });
  else setTimeout(task, 1000);
};

render(readAccountSummary(localStorageOrUndefined()));
if (hasStoredSession()) {
  whenIdle(() => {
    void getSupabase()?.then(syncAccount);
  });
} else if (document.documentElement.dataset.account) {
  update(null); // stale summary without a session
}

// Another tab signed in, signed out or changed the profile.
window.addEventListener("storage", (event) => {
  if (event.key === ACCOUNT_STORAGE_KEY || event.key === null) {
    render(readAccountSummary(localStorageOrUndefined()));
  } else if (event.key === AUTH_STORAGE_KEY && event.newValue === null) {
    update(null);
  }
});
