import { getRelativeLocaleUrl } from "astro:i18n";
import { z } from "zod";

import { LOCALE_COOKIE, negotiateLocale } from "@/i18n/negotiate";
import { getSupabaseEnv } from "@/lib/env";

import type { APIRoute } from "astro";

// Short invite links (SPEC §10.2): /r/<CODE> sends the visitor to the room's
// page in their language. Link previews follow the redirect and show that
// page's title. An unknown (or deleted) room goes to the games catalog.
export const prerender = false;

const CODE = z
  .string()
  .transform((code) => code.toUpperCase())
  .pipe(z.string().regex(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/));
const GAME = z.string().regex(/^[a-z0-9-]{1,40}$/);

async function gameOf(code: string): Promise<string | null> {
  const env = getSupabaseEnv();
  if (!env) return null;
  try {
    const response = await fetch(`${env.PUBLIC_SUPABASE_URL}/rest/v1/rpc/room_invite`, {
      method: "POST",
      headers: {
        apikey: env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_code: code }),
    });
    if (!response.ok) return null;
    const parsed = GAME.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const GET: APIRoute = async ({ params, cookies, request }) => {
  const locale = negotiateLocale({
    saved: cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language"),
  });
  const code = CODE.safeParse(params.code);
  const game = code.success ? await gameOf(code.data) : null;
  const location =
    code.success && game
      ? `${getRelativeLocaleUrl(locale, `/play/${game}/`)}?room=${code.data}`
      : getRelativeLocaleUrl(locale, "/games/");
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      Vary: "Cookie, Accept-Language",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
};
