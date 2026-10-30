// Shows today's word on the home page (WordCard.astro), if there is one in
// the page's language; otherwise the card stays hidden. Asked with the
// publishable key, without loading supabase-js.
// zod/mini: this module ships to the browser.
import * as z from "zod/mini";

import { supabaseConfig } from "@/lib/supabase/config";

const wordSchema = z.object({
  word: z.string().check(z.minLength(1), z.maxLength(40)),
  meaning: z.nullable(z.string().check(z.maxLength(300))),
});

async function show(root: HTMLElement) {
  if (!supabaseConfig) return;
  const res = await fetch(new URL("/rest/v1/rpc/word_of_the_day", supabaseConfig.url), {
    method: "POST",
    headers: { apikey: supabaseConfig.key, "content-type": "application/json" },
    body: JSON.stringify({ p_locale: root.dataset.locale ?? "en" }),
  }).catch(() => null);
  if (!res?.ok) return;
  const word = wordSchema.safeParse(await res.json().catch(() => null));
  if (!word.success) return;
  const text = root.querySelector("[data-word-text]");
  const meaning = root.querySelector("[data-word-meaning]");
  if (text) text.textContent = word.data.word;
  if (meaning) meaning.textContent = word.data.meaning ?? "";
  root.hidden = false;
}

for (const root of document.querySelectorAll<HTMLElement>("[data-word]")) void show(root);
