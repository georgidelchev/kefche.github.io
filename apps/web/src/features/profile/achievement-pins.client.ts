// The profile's showcase (no framework): on their own profile, a signed-in
// player sees a button on each achievement to pin it to the showcase (up to
// 3) or take it off. The page is the same for everyone; this only shows the
// buttons to its owner, and the database checks who's asking.
import * as z from "zod/mini";

import { localStorageOrUndefined } from "@/features/account/account-state";
import { readAccountSummary } from "@/features/account/account-summary";
import { getSupabase } from "@/lib/supabase/client";

const MAX_PINS = 3;
const pinsSchema = z.array(z.string().check(z.maxLength(80))).check(z.maxLength(MAX_PINS));

function setUp(section: HTMLElement, pins: readonly string[]) {
  const { pinLabel = "", unpinLabel = "", full = "", failed = "" } = section.dataset;
  const message = section.querySelector<HTMLElement>("[data-pin-message]");
  const say = (text: string) => {
    if (message) message.textContent = text;
  };
  for (const button of section.querySelectorAll<HTMLButtonElement>("button[data-pin]")) {
    const key = button.dataset.pin ?? "";
    const pinned = pins.includes(key);
    button.textContent = pinned ? unpinLabel : pinLabel;
    button.hidden = false;
    button.addEventListener("click", () => {
      const next = pinned ? pins.filter((k) => k !== key) : [...pins, key];
      if (next.length > MAX_PINS) {
        say(full);
        return;
      }
      button.disabled = true;
      say("");
      void (async () => {
        const supabase = await getSupabase();
        const saved = supabase
          ? await supabase.rpc("set_achievement_pins", { p_achievements: next })
          : null;
        if (!saved || saved.error) {
          say(failed);
          button.disabled = false;
          return;
        }
        location.reload();
      })();
    });
  }
}

const section = document.querySelector<HTMLElement>("[data-achievements]");
const owner = readAccountSummary(localStorageOrUndefined());
if (section && owner && owner.id === section.dataset.profileId) {
  let pins: unknown = [];
  try {
    pins = JSON.parse(section.dataset.pins ?? "[]");
  } catch {
    // Unreadable: start from an empty showcase.
  }
  const parsed = pinsSchema.safeParse(pins);
  setUp(section, parsed.success ? parsed.data : []);
}
