# CLAUDE.md

kefche is a multilingual, mobile-first browser games portal. **`docs/SPEC.md` is the source of truth; follow its Working Agreement (§0).** Phase status, plans and tracked TODOs live in `docs/PROGRESS.md`, and decisions in `docs/DECISIONS.md` (ADRs).

## Commands (run from the repo root)

| Command                                  | What it does                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm install`                           | Install. pnpm also downloads the pinned Node.js (`devEngines.runtime`).     |
| `pnpm dev`                               | Astro dev server for `apps/web` at http://localhost:4321 (runs on workerd). |
| `pnpm lint` / `pnpm lint:fix`            | ESLint over the whole repo, zero warnings allowed.                          |
| `pnpm typecheck`                         | `astro check` (web) + `tsc` (packages).                                     |
| `pnpm build`                             | Build every package that has a `build` script.                              |
| `pnpm format` / `pnpm format:check`      | Prettier.                                                                   |
| `pnpm check:contrast`                    | WCAG contrast of every token pair in both themes (`tokens.css`).            |
| `pnpm i18n:check`                        | All 11 locales match English: keys, ICU, placeholders, no unused keys.      |
| `pnpm icons:generate`                    | Rebuild favicon and app icons from `packages/ui/src/brand/marks.ts`.        |
| `pnpm avatars:generate`                  | Rebuild the 24 preset avatars in `apps/web/public/avatars/`.                |
| `pnpm new:game <id> --kind=race\|turn`   | Scaffold `packages/games/<id>/`; then replace every `TODO(new-game)`.       |
| `pnpm art:generate`                      | Rebuild each game's `assets/thumbnail.svg` and `hero.svg` from `art.mjs`.   |
| `pnpm db:start` / `db:stop` / `db:reset` | Local Supabase (needs Docker).                                              |
| `pnpm db:terms`                          | New migration from the word lists in `supabase/blocked-terms/`.             |
| `pnpm db:types`                          | Regenerate `apps/web/src/lib/supabase/database.gen.ts` (CI checks drift).   |
| `pnpm --filter web run cf:deploy`        | Deploy to Cloudflare Workers (CI does this on `main`).                      |

**Green before every commit:** `pnpm format:check && pnpm lint && pnpm check:contrast && pnpm i18n:check && pnpm typecheck && pnpm build`. The dev-only component gallery is at `/en/dev/ui/` (and `/ar/dev/ui/` for RTL).

## Layout

- `apps/web`: Astro 7 + React islands, Tailwind 4, `@astrojs/cloudflare` (Workers + static assets). Routes live under `src/pages/[locale]/`. Env vars are validated in `src/lib/env.ts` and documented in `apps/web/.env.example`.
- `packages/config`: shared `tsconfig.base.json`, ESLint preset (`eslint-preset.js`) and Prettier preset (`prettier-preset.js`). The root `eslint.config.js` and `prettier.config.js` use them.
- `apps/web/src`:
  - `i18n/`: locale registry, `getT`, negotiation.
  - `features/`:
    - `shell/`: AppShell, nav config, shell client script.
    - `theme/`: switcher and `setTheme`.
    - `i18n/`: language switcher and `rememberLocale`.
    - `account/`: header account state, preference sync, avatar URLs.
    - `auth/`: sign-in, sign-up, onboarding and guest-merge pages.
    - `profile/`: the public profile page.
    - `settings/`: the settings page.
    - `errors/`
  - `lib/supabase/`: lazy client, config, generated DB types.
  - `components/`: BootScript, Fonts, SeoHead, Logo.
  - `middleware.ts`: security headers on Worker responses.
  - Translations: `apps/web/locales/<locale>/<ns>.json`.
- `supabase/`: `migrations/`, `functions/` (Edge Functions, Deno), `blocked-terms/` (word lists → `pnpm db:terms`), `templates/` (auth emails). `public/avatars/` holds the preset avatars (`pnpm avatars:generate`).
- `packages/ui`: design tokens (`src/tokens.css`), the Tailwind theme mapping (`src/theme.css`), typography (`src/typography.css`), components (`src/components/*.tsx`, imported as `@kefche/ui/components/<name>`) and brand marks (`src/brand/marks.ts`).
- `packages/game-sdk`: game SDK. The root entry is isomorphic: engines, PRNG, manifest types, seats, bots, search and timers. `browser` holds the runtime helpers, including `createTurnSession` and `runTurnGame` for turn-based games (ADR-0018).
- `packages/games/<id>`: one package per game (template in `packages/games/README.md`; the guide is `docs/ADDING_A_GAME.md`). The player, catalog and turn-game setup and HUD live in `apps/web/src/features/games/`.
- `supabase/`: CLI project (`config.toml`, `migrations/`, `functions/`, `tests/`, `seed.sql`).

## Conventions

- **TypeScript:** strict, with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. No `any`, and `@ts-expect-error`/`@ts-ignore` only with a description. Use type-only imports (`import type`).
- **Isomorphic code:** the base tsconfig has no DOM lib and `types: []`, so engines and the SDK can't touch browser or Node globals. Browser packages add `"dom"` themselves.
- **Imports:** ordered builtin → external → `@kefche/*` → `@/*` → relative → types, alphabetized (`import-x/order`, auto-fixable).
- **Styling:** Tailwind utilities with token colors (`bg-surface`, `text-muted`, `border-border`, `text-brand`). Use logical properties only (`ms-*`, `pe-*`, `start-*`) for RTL. Theme: `<html data-theme="light|dark">`, otherwise the system theme. `@theme inline` does not emit `--color-*` variables, so plain CSS uses the raw tokens (`var(--surface)`).
- **No HTML injection:** `dangerouslySetInnerHTML` and Astro `set:html` are lint errors.
- **Validation:** Zod at every boundary (env, network messages, URL params, storage, forms). Pure functions with injected dependencies, so they stay testable.
- **Env:** only `PUBLIC_*` vars reach the browser. The Supabase key must be a publishable key (`sb_publishable_…`); secret keys never go in client code.
- **Strings:** no hard-coded user-facing text. Pages call `getT(locale)` and use full literal keys, `t("nav:home")`; never build keys dynamically (keep a literal map like `NAV_LABEL_KEYS`). Islands receive translated strings as props. A new key goes into all 11 locale files in the same commit. Every `TODO` references an entry in `docs/PROGRESS.md` ("TODO #n").
- **Client bundles:** use `zod/mini` in code that ships to the browser, and full `zod` on the server and at build time. Prefer static Astro markup plus a small `<script>` over a React island unless the component needs Radix or state.
- **Components:** labels are props (no English defaults). Corner close buttons need a `closeLabel`. Pass `dir` to Radix components that use arrow keys.
- **New pages:** wrap them in `AppShell`. A section's real page replaces its coming-soon entry: flip it to `available` in `features/shell/nav.ts`.
- **Database:**
  - **Migrations:** they live in `supabase/migrations/`. Never edit one that's already on `main`; add a new one.
  - **After a schema change:** run `pnpm db:reset && pnpm db:types && pnpm exec supabase db lint --level warning`, and commit the regenerated types.
  - **`private` schema:** internal tables and functions go there; the Data API doesn't expose it.
  - **Public RPCs:** use `security definer` with `set search_path = ''`, check `auth.uid()`, and grant `execute` explicitly (revoke from `public`).
  - **Under `search_path = ''`:** extension types and operators need their schema, as in `nickname operator(extensions.=) x::extensions.citext`.
  - **Error codes:** errors meant for the client carry a stable code as the message (`nickname_taken`), which the app translates.
- **Edge Functions** (`supabase/functions/<name>/index.ts`, Deno 2):
  - **Dependencies:** shared imports live in `supabase/functions/deno.json`, pinned exactly, with `deno.lock` committed. Helpers go in `_shared/`.
  - **Request handling:** verify every token with Supabase Auth, validate input with Zod, return a stable error code, and log details with `log()`.
  - **Checks:** ESLint skips this folder; CI runs `deno lint` and `deno check --frozen`. Locally, without Deno: `docker run --rm -v "$PWD/supabase/functions:/fn" -w /fn denoland/deno:2.1.4 sh -c "deno lint && deno check */index.ts"`.
- **Commits:** Conventional Commits, one small focused commit per step.

## Dependencies

- Pin exact versions (`saveExact`). Check current docs before adding a library and record notable choices as an ADR.
- pnpm refuses versions published less than 24 h ago (`minimumReleaseAge`). Pick the newest version older than that; don't add exclusions.
- Dependency build scripts are denied unless listed under `allowBuilds` in `pnpm-workspace.yaml`. Review a script before allowing it.
- Don't upgrade to TypeScript 7 yet: typescript-eslint and `@astrojs/check` support ≤ 6.0 (ADR-0005).

## Gotchas

- ESLint 10 uses the nearest `eslint.config.*` for each file, so shared presets must not be named `eslint.config.js`.
- `pnpm -r <script>` fails when a package lacks the script; root scripts use `--if-present`.
- Type-aware ESLint finds each file's nearest file named `tsconfig.json`. A folder with different compiler options needs its own `tsconfig.json`, like `packages/game-sdk/src/browser/`, which adds DOM types. After adding or moving one, delete `.eslintcache`.
- Restart `pnpm dev` after `pnpm install` adds packages. A dev server that keeps running re-bundles dependencies mid-session and can end up with two copies of React. Pages then render blank, and the log shows "Cannot read properties of null (reading 'useState')" or a missing `.vite/deps_ssr` file. To fix it, stop the server, delete `apps/web/node_modules/.vite` and start `pnpm dev` again.
- Stopping a background `pnpm dev` can leave Astro's dev server running ("Another astro dev server is already running"), and a stopped `preview` can leave `workerd` holding `dist/` (build fails with EPERM). Run `pnpm --filter web exec astro dev stop`, and stop the leftover `node`/`workerd` processes.
- Never run `pnpm deploy`, which is a built-in pnpm command. Use `pnpm --filter web run cf:deploy`.
- `public/_headers` applies only to static assets. `src/middleware.ts` copies its `/*` headers onto Worker-rendered responses, so edit only `_headers`.
- Never add an Astro `redirects` entry for a dynamic path: Cloudflare applies `_redirects` before the Worker runs.
- Astro 7 compiles with stricter HTML rules: no unclosed tags, no invalid nesting. Its `compressHTML: "jsx"` default drops whitespace between text and inline elements, so write `{" "}` where a space matters.
- In `.astro` files, pass icons to React components as named slots (`<Inbox slot="icon" />`), not as JSX props.
- Windows PowerShell 5.1: pass multi-line commit messages with `git commit -F <file>`, because here-strings with quotes get mangled. `Add-Content` writes CRLF; prefer editor tools.
