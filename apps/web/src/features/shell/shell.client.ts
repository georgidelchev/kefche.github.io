// Client behavior for the static shell (no framework): popovers built on
// <details data-popover>, remembering language choices, and the rail toggle.
import { rememberLocale } from "@/features/i18n/locale-preference";
import { isLocale } from "@/i18n/locales";

import { RAIL_STORAGE_KEY } from "./rail";

function closeOthers(except?: HTMLDetailsElement) {
  for (const d of document.querySelectorAll<HTMLDetailsElement>("details[data-popover][open]")) {
    if (d !== except) d.open = false;
  }
}

// Escape closes the innermost open popover and returns focus to its summary.
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const open = [...document.querySelectorAll<HTMLDetailsElement>("details[data-popover][open]")].at(
    -1,
  );
  if (!open) return;
  open.open = false;
  open.querySelector("summary")?.focus();
});

document.addEventListener("click", (event) => {
  const target = event.target as Element;

  // Clicking outside every open popover closes them.
  const inside = target.closest<HTMLDetailsElement>("details[data-popover]");
  closeOthers(inside ?? undefined);

  // An explicit language choice is remembered for `/` and future visits (SPEC §5).
  const link = target.closest<HTMLAnchorElement>("a[data-locale]");
  const locale = link?.dataset.locale;
  if (isLocale(locale)) rememberLocale(locale, { announce: true });

  // Side rail compact toggle (large screens).
  const toggle = target.closest<HTMLButtonElement>("button[data-rail-toggle]");
  if (toggle) {
    const root = document.documentElement;
    const compact = root.dataset.rail !== "compact";
    if (compact) root.dataset.rail = "compact";
    else delete root.dataset.rail;
    toggle.setAttribute("aria-pressed", String(compact));
    try {
      if (compact) localStorage.setItem(RAIL_STORAGE_KEY, "compact");
      else localStorage.removeItem(RAIL_STORAGE_KEY);
    } catch {
      // Not persisted; applies to this page view.
    }
  }
});

// Reflect the state applied by BootScript before paint.
const compactNow = document.documentElement.dataset.rail === "compact";
for (const t of document.querySelectorAll("button[data-rail-toggle]")) {
  t.setAttribute("aria-pressed", String(compactNow));
}
