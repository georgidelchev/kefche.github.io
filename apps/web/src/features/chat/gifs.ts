// GIFs in chat (SPEC §8.2, Phase 8 step 10): search and trending through
// the `giphy` Edge Function, and a GIF's image from its id on GIPHY's media
// domain (messages store ids, never URLs). zod/mini: this module ships to
// the browser.
import * as z from "zod/mini";

import type { Supabase } from "@/lib/supabase/client";

export const GIF_ID = /^[A-Za-z0-9]{1,64}$/;

/** A GIF's image: 200 px high in messages, 200 px wide in the picker. */
export function gifUrl(id: string, fit: "height" | "width" = "height"): string | null {
  if (!GIF_ID.test(id)) return null;
  return `https://media.giphy.com/media/${id}/${fit === "height" ? "200" : "200w"}.webp`;
}

const answerSchema = z.object({
  gifs: z.array(
    z.object({ id: z.string(), title: z.string(), width: z.number(), height: z.number() }),
  ),
  next: z.nullable(z.number()),
});
export type GifPage = z.infer<typeof answerSchema>;

/** GIPHY's language codes, from the page's locale. */
const GIPHY_LANG: Record<string, string> = { zh: "zh-CN" };

/** Trending (no query) or a search; `busy` when the site's GIPHY budget is spent. */
export async function findGifs(
  supabase: Supabase,
  query: string,
  offset: number,
  locale: string,
): Promise<GifPage | "busy" | "failed"> {
  const q = query.trim();
  const reply = await supabase.functions.invoke<unknown>("giphy", {
    body: { ...(q === "" ? {} : { q }), offset, lang: GIPHY_LANG[locale] ?? locale },
  });
  const error: unknown = reply.error;
  const data: unknown = reply.data;
  if (error) {
    const context = (error as { context?: unknown }).context;
    const body: unknown =
      context instanceof Response ? await context.json().catch(() => null) : null;
    const code = (body as { error?: unknown } | null)?.error;
    return code === "busy" || code === "rate_limited" ? "busy" : "failed";
  }
  const parsed = answerSchema.safeParse(data);
  return parsed.success ? parsed.data : "failed";
}
