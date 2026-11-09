import { i18nReport } from "@/features/admin/i18n-report";
import { authStaticPaths } from "@/features/auth/page-helpers";
import { DEFAULT_LOCALE } from "@/i18n/locales";

import type { APIRoute, GetStaticPaths } from "astro";

// The translation report as a static JSON file, read by the admin panel's
// i18n section (Phase 10 step 9). One copy, under the default locale; it holds
// only what the public locale files already say.
export const getStaticPaths = (() =>
  authStaticPaths().filter(
    ({ params }) => params.locale === DEFAULT_LOCALE,
  )) satisfies GetStaticPaths;

export const GET: APIRoute = () =>
  new Response(JSON.stringify({ locales: i18nReport() }), {
    headers: { "Content-Type": "application/json" },
  });
