// Fills in the home page's daily challenge (DailyCard.astro): today's game,
// the link to play it, and a countdown to the next one, which starts at
// 00:00 UTC and is shown in local time. When the day turns, it asks again.
// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import { fetchDaily } from "@/features/games/daily";
import { fill } from "@/features/games/turn/labels";

const namesSchema = z.record(z.string(), z.string());

/** "5 hr 12 min", "12 min", in the page's language. */
function countdownText(ms: number, locale: string): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  const unit = (value: number, name: "hour" | "minute") =>
    new Intl.NumberFormat(locale, { style: "unit", unit: name, unitDisplay: "short" }).format(
      value,
    );
  const hours = Math.floor(minutes / 60);
  return hours > 0
    ? `${unit(hours, "hour")} ${unit(minutes % 60, "minute")}`
    : unit(minutes, "minute");
}

async function setUp(root: HTMLElement) {
  const locale = root.dataset.locale ?? "en";
  const today = root.querySelector<HTMLElement>("[data-daily-today]");
  const play = root.querySelector<HTMLAnchorElement>("[data-daily-play]");
  const next = root.querySelector<HTMLElement>("[data-daily-next]");
  if (!today || !play || !next) return;
  const names = namesSchema.safeParse(JSON.parse(root.dataset.names ?? "{}"));

  const daily = await fetchDaily();
  if (!daily) {
    today.textContent = root.dataset.unavailable ?? "";
    return;
  }
  const name = (names.success ? names.data[daily.gameId] : undefined) ?? daily.gameId;
  today.textContent = fill(root.dataset.today ?? "{game}", { game: name });
  play.href = `${root.dataset.gamesBase ?? "/"}${daily.gameId}/?daily`;
  play.hidden = false;

  const endsAt = new Date(daily.endsAt);
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(
    endsAt,
  );
  const tick = () => {
    const left = endsAt.getTime() - Date.now();
    if (left <= 0) {
      // A new day: its game, its board.
      location.reload();
      return;
    }
    next.textContent = fill(root.dataset.next ?? "", {
      countdown: countdownText(left, locale),
      time,
    });
    setTimeout(tick, Math.min(30_000, left));
  };
  tick();
}

for (const root of document.querySelectorAll<HTMLElement>("[data-daily]")) void setUp(root);
