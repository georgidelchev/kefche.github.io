// A profile's online status (no framework): shown under the nickname when
// the viewer may see it (presence_of decides), and kept live for a friend.
// The page is cached and the same for everyone, so it starts hidden.
// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import { getSupabase, hasStoredSession } from "@/lib/supabase/client";

import { fetchStatuses, onPresenceChange, presenceText, type Status } from "./presence";
import { LIVE_RESUME_EVENT } from "./presence-context";

const stringsSchema = z.object({
  online: z.string(),
  lobby: z.string(),
  playing: z.string(),
  away: z.string(),
});
const namesSchema = z.record(z.string(), z.string());

const el = document.querySelector<HTMLElement>("[data-presence]");
const strings = stringsSchema.safeParse(JSON.parse(el?.dataset.strings ?? "{}"));
const names = namesSchema.safeParse(JSON.parse(el?.dataset.games ?? "{}"));

if (el && strings.success && names.success) {
  const userId = el.dataset.userId ?? "";
  const label = el.querySelector<HTMLElement>("[data-presence-text]");
  const dot = el.querySelector<HTMLElement>("[data-presence-dot]");
  const show = (status: Status | null) => {
    el.hidden = status === null;
    if (!status || !label || !dot) return;
    label.textContent = presenceText(status, strings.data, names.data);
    const away = status.status === "away";
    dot.classList.toggle("bg-success", !away);
    dot.classList.toggle("bg-warning", away);
  };
  const read = async () => {
    const supabase = hasStoredSession() ? await getSupabase() : null;
    show((await fetchStatuses(supabase, [userId]))[userId] ?? null);
  };
  void read();
  onPresenceChange((user, status) => {
    if (user === userId) show(status);
  });
  document.addEventListener(LIVE_RESUME_EVENT, () => void read());
}
