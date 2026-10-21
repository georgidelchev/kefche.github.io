import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";

import { DEFAULT_LOCALE, LOCALES } from "./src/i18n/locales";

// Self-hosted at build time (no third-party font requests). SPEC §5 / §6.4:
// one UI face for Latin/Cyrillic/Greek, a display face for headings, and
// script-specific Noto faces loaded only by the locales that need them.
// Chinese and Japanese use the system stack (see src/styles/global.css).
const fontsource = fontProviders.fontsource();

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  // Canonical origin for canonical/hreflang/OG URLs. Previews also point here,
  // so they are never treated as the canonical copy. Custom domain: Phase 21.
  site: "https://kefche.alienguymc.workers.dev",
  i18n: {
    locales: [...LOCALES],
    defaultLocale: DEFAULT_LOCALE,
    // Every route carries its locale (/en/…); `/` negotiates one (src/pages/index.ts).
    routing: { prefixDefaultLocale: true, redirectToDefaultLocale: false },
  },
  // Pages are prerendered by default; the adapter serves the few on-demand
  // routes added later (public profiles, room invites) from a Cloudflare Worker.
  adapter: cloudflare({
    // Optimize images at build time; no paid Cloudflare Images binding.
    imageService: "compile",
  }),
  // Auth sessions live in Supabase, so no Astro sessions and no KV namespace.
  session: false,
  integrations: [react()],
  fonts: [
    {
      provider: fontsource,
      name: "Inter",
      cssVariable: "--font-inter",
      weights: ["100 900"],
      styles: ["normal"],
      subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext", "greek"],
      fallbacks: ["system-ui", "sans-serif"],
    },
    {
      provider: fontsource,
      name: "Unbounded",
      cssVariable: "--font-unbounded",
      weights: ["200 900"],
      styles: ["normal"],
      subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
      fallbacks: ["system-ui", "sans-serif"],
    },
    {
      provider: fontsource,
      name: "Noto Sans Arabic",
      cssVariable: "--font-noto-arabic",
      weights: ["100 900"],
      styles: ["normal"],
      subsets: ["arabic"],
      fallbacks: ["sans-serif"],
    },
    {
      provider: fontsource,
      name: "Noto Sans Devanagari",
      cssVariable: "--font-noto-devanagari",
      weights: ["100 900"],
      styles: ["normal"],
      subsets: ["devanagari"],
      fallbacks: ["sans-serif"],
    },
  ],
  vite: {
    plugins: [tailwindcss()],
    // Dev only: pre-bundle these up front. Otherwise Vite discovers
    // astro:i18n late on a cold start, re-optimizes mid-request and React
    // renders with two copies ("Invalid hook call") until the reload.
    ssr: {
      optimizeDeps: {
        include: [
          "astro/virtual-modules/i18n.js",
          "react",
          "react-dom/server.edge",
          "lucide-react",
        ],
      },
    },
  },
});
