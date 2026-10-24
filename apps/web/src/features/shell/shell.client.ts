// Client behavior for the static shell (no framework): popovers built on
// <details data-popover>, language links (remembered, and keeping the page's
// query), and the rail toggle.
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

// A language link keeps the current address's query and hash, which can
// change after load (a game room adds ?room=CODE), so the reader stays on the
// same view: set them as the link is used, by click, keyboard or new tab.
function keepAddress(target: EventTarget | null) {
  const link = (target as Element | null)?.closest<HTMLAnchorElement>("a[data-locale]");
  if (!link) return;
  const url = new URL(link.href);
  url.search = location.search;
  url.hash = location.hash;
  link.href = url.href;
}
document.addEventListener("pointerdown", (event) => {
  keepAddress(event.target);
});

document.addEventListener("click", (event) => {
  const target = event.target as Element;

  // Clicking outside every open popover closes them.
  const inside = target.closest<HTMLDetailsElement>("details[data-popover]");
  closeOthers(inside ?? undefined);

  // An explicit language choice is remembered for `/` and future visits (SPEC §5).
  keepAddress(target);
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
