import { getRelativeLocaleUrl } from "astro:i18n";

import { LOCALE_COOKIE, negotiateLocale } from "@/i18n/negotiate";

import type { APIRoute } from "astro";

// Runs in the Worker on every request: the answer depends on the visitor.
export const prerender = false;

export const GET: APIRoute = ({ cookies, request }) => {
  const locale = negotiateLocale({
    saved: cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language"),
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: getRelativeLocaleUrl(locale, "/"),
      Vary: "Cookie, Accept-Language",
      "Cache-Control": "private, no-store",
    },
  });
};
