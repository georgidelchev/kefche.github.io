// Account state in the browser: the cached summary and the header avatar.
// No side effects at import, so islands rendered on the server can import it;
// the functions themselves only run in the browser.
import { levelForXp } from "@kefche/game-sdk";
import { initialsFor, paletteIndexFor } from "@kefche/ui/lib/avatar";
import { isAvatarFrame, SMALL_FRAME_CLASSES } from "@kefche/ui/lib/frames";

import type { Supabase } from "@/lib/supabase/client";
import { supabaseConfig } from "@/lib/supabase/config";

import {
  readAccountSummary,
  writeAccountSummary,
  type AccountSummary,
  type KeyValueStorage,
} from "./account-summary";
import { avatarUrl } from "./avatar-url";
import { clearUnsaved, syncPreferences } from "./preferences-sync";

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
    const hasPicture = summary.avatarUrl !== null;
    // The player color is the initials' background; pictures bring their own.
    avatar.style.backgroundColor = hasPicture ? "transparent" : `var(--player-${slot})`;
    avatar.style.color = `var(--player-${slot}-ink)`;
    // The URL was validated by the summary schema (no quotes or parentheses).
    avatar.style.backgroundImage = summary.avatarUrl ? `url("${summary.avatarUrl}")` : "";
    const label = avatar.querySelector("[data-account-initials]");
    if (label) label.textContent = hasPicture ? "" : initials;
    avatar
      .querySelector("[data-account-icon]")
      ?.toggleAttribute("hidden", hasPicture || initials !== "");
    // The frame worn: one set of ring classes at a time.
    for (const classes of Object.values(SMALL_FRAME_CLASSES))
      avatar.classList.remove(...classes.split(" "));
    if (isAvatarFrame(summary.frame))
      avatar.classList.add(...SMALL_FRAME_CLASSES[summary.frame].split(" "));
  }
  const level = summary.level?.toLocaleString(root.lang);
  for (const badge of document.querySelectorAll<HTMLElement>("[data-account-level]")) {
    badge.textContent = level ?? "";
    badge.hidden = level === undefined;
  }
  // "Your account, level 4": the link's name says what the badge shows.
  for (const link of document.querySelectorAll<HTMLElement>("[data-label-level]")) {
    const label = level ? link.dataset.labelLevel?.replace("{level}", level) : link.dataset.label;
    if (label) link.setAttribute("aria-label", label);
  }
}

/** Caches and shows `summary`. */
export function setAccount(summary: AccountSummary | null): void {
  writeAccountSummary(localStorageOrUndefined(), summary);
  renderAccount(summary);
}

/**
 * Re-reads the session and profile and updates the cached summary and the
 * header, and syncs theme and language with the profile. Guests (anonymous
 * sessions) count as signed out here: they see "Sign in". Call after any
 * sign-in, sign-out or profile change.
 */
export async function syncAccount(supabase: Supabase): Promise<AccountSummary | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return readAccountSummary(localStorageOrUndefined()); // no connection: keep the cache
  const user = data.session?.user;
  if (!user || user.is_anonymous === true) {
    setAccount(null);
    return null;
  }
  const profile = await supabase
    .from("profiles")
    .select("nickname, avatar_kind, avatar_preset, avatar_path, xp, avatar_frame")
    .eq("id", user.id)
    .maybeSingle();
  if (profile.error) return readAccountSummary(localStorageOrUndefined());
  const summary: AccountSummary = {
    id: user.id,
    nickname: profile.data?.nickname ?? null,
    avatarUrl: profile.data && supabaseConfig ? avatarUrl(profile.data, supabaseConfig.url) : null,
    level: levelForXp(profile.data?.xp ?? 0),
    frame: profile.data?.avatar_frame ?? null,
  };
  setAccount(summary);
  await syncPreferences(supabase, user.id);
  return summary;
}

/** Signs out (this device, or everywhere) and forgets the account locally. */
export async function signOut(supabase: Supabase, scope: "local" | "global"): Promise<void> {
  await supabase.auth.signOut({ scope });
  clearUnsaved();
  setAccount(null);
}
