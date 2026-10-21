import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  // Pages are prerendered by default; the adapter serves the few on-demand
  // routes added later (public profiles, room invites) from a Cloudflare Worker.
  adapter: cloudflare({
    // Optimize images at build time; no paid Cloudflare Images binding.
    imageService: "compile",
  }),
  // Auth sessions live in Supabase, so no Astro sessions and no KV namespace.
  session: false,
  integrations: [react()],
  // Temporary (302) so browsers don't cache it: locale detection
  // (saved preference → Accept-Language → en) arrives with i18n in Phase 1.
  redirects: { "/": { status: 302, destination: "/en/" } },
  vite: {
    plugins: [tailwindcss()],
  },
});
