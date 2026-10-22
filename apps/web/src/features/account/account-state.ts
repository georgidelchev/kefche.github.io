// Account state in the browser: the cached summary and the header avatar.
// No side effects at import, so islands rendered on the server can import it;
// the functions themselves only run in the browser.
import { initialsFor, paletteIndexFor } from "@kefche/ui/lib/avatar";

import type { Supabase } from "@/lib/supabase/client";

import {
  readAccountSummary,
  writeAccountSummary,
  type AccountSummary,
  type KeyValueStorage,
} from "./account-summary";

export function localStorageOrUndefined(): KeyValueStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Shows `summary` in every header account control (null: signed out). */
export function renderAccount(summary: AccountSummary | null): void {
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

/** Caches and shows `summary`. */
export function setAccount(summary: AccountSummary | null): void {
  writeAccountSummary(localStorageOrUndefined(), summary);
  renderAccount(summary);
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
    setAccount(null);
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
  setAccount(summary);
  return summary;
}
