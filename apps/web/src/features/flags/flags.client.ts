// Reads the feature flags on every page and marks those off on <html
// data-flags-off="gifs quick_match">: CSS (global.css) then hides each
// `[data-flag=<key>]` and shows each `[data-flag-notice=<key>]`. The list is
// kept for the next page's boot script, so nothing flashes. Without
// Supabase, or offline, the last list stays.
// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import { supabaseConfig } from "@/lib/supabase/config";

import { FLAG_KEYS, FLAGS_STORAGE_KEY } from "./flags";

const rowsSchema = z.array(z.object({ key: z.string(), enabled: z.boolean() }));

async function refresh() {
  if (!supabaseConfig) return;
  const res = await fetch(
    new URL("/rest/v1/feature_flags?select=key,enabled", supabaseConfig.url),
    {
      headers: { apikey: supabaseConfig.key },
    },
  ).catch(() => null);
  if (!res?.ok) return;
  const rows = rowsSchema.safeParse(await res.json().catch(() => null));
  if (!rows.success) return;
  const off = rows.data
    .filter((row) => !row.enabled && (FLAG_KEYS as readonly string[]).includes(row.key))
    .map((row) => row.key)
    .join(" ");
  const root = document.documentElement;
  if (off) root.dataset.flagsOff = off;
  else delete root.dataset.flagsOff;
  try {
    if (off) localStorage.setItem(FLAGS_STORAGE_KEY, off);
    else localStorage.removeItem(FLAGS_STORAGE_KEY);
  } catch {
    // Storage unavailable: the next page checks again.
  }
}

void refresh();
