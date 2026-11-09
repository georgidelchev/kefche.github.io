// Fills the news ticker (NewsTicker.astro) with the announcements marked for
// it, in the page's language or English. Asked with the publishable key,
// without loading supabase-js; text goes in as text, links only to paths on
// this site.
// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import { supabaseConfig } from "@/lib/supabase/config";

const itemsSchema = z.array(
  z.object({
    id: z.string(),
    texts: z.record(z.string(), z.string()),
    url: z.nullable(z.string()),
    sent_at: z.string(),
  }),
);

/** Only a path on this site ("//" and "/\" lead elsewhere). */
const sitePath = (url: string | null) => (url !== null && /^\/[^/\\]/.test(url) ? url : null);

async function show(root: HTMLElement) {
  const list = root.querySelector("[data-news-list]");
  if (!supabaseConfig || !list) return;
  const res = await fetch(
    new URL(
      "/rest/v1/announcements?select=id,texts,url,sent_at&order=sent_at.desc&limit=5",
      supabaseConfig.url,
    ),
    { headers: { apikey: supabaseConfig.key } },
  ).catch(() => null);
  if (!res?.ok) return;
  const items = itemsSchema.safeParse(await res.json().catch(() => null));
  if (!items.success || items.data.length === 0) return;
  const locale = root.dataset.locale ?? "en";
  for (const item of items.data) {
    const text = item.texts[locale] ?? item.texts.en;
    if (!text) continue;
    const li = document.createElement("li");
    const url = sitePath(item.url);
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.textContent = text;
      a.className =
        "rounded font-semibold underline decoration-border-strong underline-offset-4 hover:decoration-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
      li.append(a);
    } else {
      li.textContent = text;
    }
    li.dir = "auto";
    list.append(li);
  }
  if (list.childElementCount > 0) root.hidden = false;
}

for (const root of document.querySelectorAll<HTMLElement>("[data-news]")) void show(root);
