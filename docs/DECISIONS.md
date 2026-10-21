# Architecture Decision Records

Short ADRs: context, decision, consequences. Newest last. Never rewrite an accepted ADR; supersede it with a new one.

---

## ADR-0001: pnpm 12 workspaces, with Node.js pinned by pnpm

**Date:** 2026-10-21 · **Status:** Accepted

**Context.** The spec requires a pnpm monorepo with exact versions. The owner's machine had an older Node 24 (24.15.0) and no admin rights to install globally. pnpm 11+ blocks dependency build scripts by default and supports a release-age gate.

**Decision.**

- pnpm 12.14.0 via `packageManager`, activated with Corepack.
- Node.js 24.22.1 (Active LTS) via `devEngines.runtime` with `onFail: download`. pnpm downloads it, records per-platform checksums in the lockfile, and runs all scripts with it. `.nvmrc` mirrors it for other tools.
- `saveExact: true`, and `minimumReleaseAge: 1440` set explicitly so it is strict: a version newer than 24 h fails resolution instead of silently falling back.
- Build scripts are allowed only per package in `allowBuilds` (esbuild, workerd and supabase allowed; unrs-resolver denied).
- Plain `pnpm -r --if-present` scripts with no task runner (Turborepo/Nx) until build times justify one.

**Consequences.** CI and every machine run the same Node without manual installs. Brand-new releases can't be added the same day. Each new package that needs a build script requires a reviewed `allowBuilds` entry.

---

## ADR-0002: Astro 7 with React islands, static-first

**Date:** 2026-10-21 · **Status:** Accepted

**Context.** SEO pages (100 games × 11 locales) should be static. A few routes (public profiles, room invites) need on-demand rendering for link previews.

**Decision.** Astro 7.4 (Vite 8, Rust compiler) with `@astrojs/react` 7.1 and `@astrojs/cloudflare` 14.4. Output stays `static`, and individual routes opt into on-demand rendering later. The adapter is configured with `imageService: "compile"` (build-time optimization) and Astro sessions are off (`session: false`), so no Cloudflare Images or KV bindings are provisioned. Auth sessions belong to Supabase.

**Consequences.** Near-zero JS on content pages by default. `astro dev`/`astro preview` run on workerd, matching production. Astro 7's Rust compiler rejects invalid HTML (unclosed tags, bad nesting).

---

## ADR-0003: Host on Cloudflare Workers (static assets), deploy from GitHub Actions

**Date:** 2026-10-21 · **Status:** Accepted (owner approved Workers instead of Pages)

**Context.** The spec says Cloudflare Pages. `@astrojs/cloudflare` v13+ no longer supports Pages; it targets Workers with static assets, which is also where Cloudflare is moving Pages users. Workers static assets support `_headers` and `_redirects`. Workers Builds (Cloudflare's Git integration) preinstalls pnpm 10, which can't read our pnpm 12 lockfile, and it doesn't wait for our checks.

**Decision.** Deploy the `kefche` Worker with Wrangler from the CI workflow after lint/typecheck/build pass: `wrangler deploy` on `main` and `wrangler versions upload --preview-alias pr-<n>` for same-repo PRs. Credentials are the repo variable `CLOUDFLARE_ACCOUNT_ID` and the secret `CLOUDFLARE_API_TOKEN`. The deploy job is skipped until both exist.

**Consequences.** One toolchain for check and deploy, and deploys are gated on green checks. `_headers` covers static assets only, so on-demand routes must set security headers in middleware. Free plan: static asset requests are free; Worker invocations count toward the daily request limit.

---

## ADR-0004: Tailwind CSS 4 with CSS-variable design tokens

**Date:** 2026-10-21 · **Status:** Accepted

**Context.** We need light/dark/system themes without a flash, tokens shared by the app and games, and RTL support.

**Decision.** Tailwind 4.3 via `@tailwindcss/vite`. Tokens are plain CSS variables in `@kefche/ui/tokens.css`: a light set on `:root`, and a dark set under `prefers-color-scheme: dark` (unless `data-theme="light"`) and under `[data-theme="dark"]`. `@kefche/ui/theme.css` maps them to Tailwind colors with `@theme inline`, so utilities switch with the theme and `dark:` variants aren't needed for colors.

**Consequences.** Theme switching is just an attribute change. `@theme inline` doesn't emit `--color-*` aliases, so hand-written CSS uses the raw token variables.

---

## ADR-0005: TypeScript 6.0, not 7

**Date:** 2026-10-21 · **Status:** Accepted

**Context.** TypeScript 7 (native) is the latest release, but `typescript-eslint` 8.72 supports `<6.1` and `@astrojs/check` supports `^5 || ^6`.

**Decision.** Pin TypeScript 6.0.3 everywhere. The base tsconfig avoids options deprecated in 6.0 (no `baseUrl`, `moduleResolution: bundler`). Revisit when both tools support 7.

**Consequences.** Type-aware linting and `astro check` work. The upgrade later should be small because no deprecated options are used.

---

## ADR-0006: ESLint 10 and plugin choices

**Date:** 2026-10-21 · **Status:** Accepted

**Context.** The spec asks for typescript-eslint strict, React, jsx-a11y and import-order rules with zero warnings. On ESLint 10, `eslint-plugin-react` and `eslint-plugin-jsx-a11y` don't support it, and `eslint-plugin-astro` 3 requires ESLint ≥ 10.

**Decision.** One flat config run from the root (`packages/config/eslint-preset.js`): typescript-eslint `strictTypeChecked` + `stylisticTypeChecked` with the project service; `@eslint-react/eslint-plugin` `strict-type-checked` (the maintained React plugin for flat config and ESLint 10) + `eslint-plugin-react-hooks`; `eslint-plugin-jsx-a11y-x` `strict` (an ESLint 10 fork of jsx-a11y, also used by eslint-plugin-astro); `eslint-plugin-import-x` for ordering; `eslint-plugin-astro` recommended + jsx-a11y-strict; `eslint-config-prettier` last. `dangerouslySetInnerHTML` and `set:html` are errors. Type-aware rules are disabled inside `.astro` files, whose virtual script files belong to no tsconfig program, so logic belongs in `.ts`.

**Consequences.** Full type-aware linting for TS/TSX. Unresolved-import checks are left to TypeScript.

---

## ADR-0007: Supabase publishable keys instead of the legacy anon key

**Date:** 2026-10-21 · **Status:** Accepted

**Context.** The spec says to use the "anon key" in the client. Supabase replaced it with publishable keys (`sb_publishable_…`) and secret keys (`sb_secret_…`), and is deprecating the legacy JWT keys by the end of 2026.

**Decision.** The client uses `PUBLIC_SUPABASE_PUBLISHABLE_KEY`, which has the same role as the anon key. Env validation rejects anything not starting with `sb_publishable_`, so a secret key can't be bundled by mistake.

**Consequences.** Same security model (RLS-protected, safe to expose). Edge Functions will use the secret key from function secrets.
