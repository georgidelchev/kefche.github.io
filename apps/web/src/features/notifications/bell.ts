// The header's bell (AppShell, `[data-bell]`): the unread count, from each
// status report (UNREAD_EVENT), plus one for each notification that arrives
// live. The notifications page reads them all and says the count is 0. No
// dependencies: every page's shell script imports this.
import { LIVE_EVENT, UNREAD_EVENT } from "@/features/live/presence-context";

export function startBell(): void {
  const bell = document.querySelector<HTMLElement>("[data-bell]");
  const badge = bell?.querySelector<HTMLElement>("[data-bell-count]");
  const label = bell?.querySelector<HTMLElement>("[data-bell-label]");
  if (!bell || !badge || !label) return;
  const name = label.textContent;
  const unread = bell.dataset.unread ?? "{count}";
  let count = 0;

  const show = (next: number) => {
    count = Math.max(0, next);
    badge.hidden = count === 0;
    badge.textContent = count > 9 ? "9+" : String(count);
    label.textContent =
      count === 0
        ? name
        : `${name}, ${unread.replace("{count}", count.toLocaleString(document.documentElement.lang))}`;
  };

  document.addEventListener(UNREAD_EVENT, (event) => {
    const detail = (event as CustomEvent<{ count?: unknown }>).detail;
    if (typeof detail.count === "number") show(detail.count);
  });
  document.addEventListener(LIVE_EVENT, (event) => {
    if ((event as CustomEvent<{ event?: unknown }>).detail.event === "notification")
      show(count + 1);
  });
}
