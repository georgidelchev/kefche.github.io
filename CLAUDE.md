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
| `pnpm db:start` / `db:stop` / `db:reset` | Local Supabase (needs Docker).                                              |
| `pnpm --filter web run cf:deploy`        | Deploy to Cloudflare Workers (CI does this on `main`).                      |

**Green before every commit:** `pnpm format:check && pnpm lint && pnpm typecheck && pnpm build`.

## Layout

- `apps/web`: Astro 7 + React islands, Tailwind 4, `@astrojs/cloudflare` (Workers + static assets). Routes live under `src/pages/[locale]/`. Env vars are validated in `src/lib/env.ts` and documented in `apps/web/.env.example`.
- `packages/config`: shared `tsconfig.base.json`, ESLint preset (`eslint-preset.js`) and Prettier preset (`prettier-preset.js`). The root `eslint.config.js` and `prettier.config.js` use them.
- `packages/ui`: design tokens (`src/tokens.css`) and the Tailwind theme mapping (`src/theme.css`).
- `packages/game-sdk`: isomorphic game SDK (Phase 3).
- `packages/games/<id>`: one package per game (template in `packages/games/README.md`).
- `supabase/`: CLI project (`config.toml`, `migrations/`, `functions/`, `tests/`, `seed.sql`).

## Conventions

- **TypeScript:** strict, with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. No `any`, and `@ts-expect-error`/`@ts-ignore` only with a description. Use type-only imports (`import type`).
- **Isomorphic code:** the base tsconfig has no DOM lib and `types: []`, so engines and the SDK can't touch browser or Node globals. Browser packages add `"dom"` themselves.
- **Imports:** ordered builtin → external → `@kefche/*` → `@/*` → relative → types, alphabetized (`import-x/order`, auto-fixable).
- **Styling:** Tailwind utilities with token colors (`bg-surface`, `text-muted`, `border-border`, `text-brand`). Use logical properties only (`ms-*`, `pe-*`, `start-*`) for RTL. Theme: `<html data-theme="light|dark">`, otherwise the system theme. `@theme inline` does not emit `--color-*` variables, so plain CSS uses the raw tokens (`var(--surface)`).
- **No HTML injection:** `dangerouslySetInnerHTML` and Astro `set:html` are lint errors.
- **Validation:** Zod at every boundary (env, network messages, URL params, storage, forms). Pure functions with injected dependencies, so they stay testable.
- **Env:** only `PUBLIC_*` vars reach the browser. The Supabase key must be a publishable key (`sb_publishable_…`); secret keys never go in client code.
- **Strings:** no hard-coded user-facing text once i18n lands (Phase 1). Every `TODO` references an entry in `docs/PROGRESS.md` ("TODO #n").
- **Commits:** Conventional Commits, one small focused commit per step.

## Dependencies

- Pin exact versions (`saveExact`). Check current docs before adding a library and record notable choices as an ADR.
- pnpm refuses versions published less than 24 h ago (`minimumReleaseAge`). Pick the newest version older than that; don't add exclusions.
- Dependency build scripts are denied unless listed under `allowBuilds` in `pnpm-workspace.yaml`. Review a script before allowing it.
- Don't upgrade to TypeScript 7 yet: typescript-eslint and `@astrojs/check` support ≤ 6.0 (ADR-0005).

## Gotchas

- ESLint 10 uses the nearest `eslint.config.*` for each file, so shared presets must not be named `eslint.config.js`.
- `pnpm -r <script>` fails when a package lacks the script; root scripts use `--if-present`.
- Never run `pnpm deploy`, which is a built-in pnpm command. Use `pnpm --filter web run cf:deploy`.
- `public/_headers` applies only to static assets. On-demand (Worker-rendered) routes must set security headers in Astro middleware.
- Astro 7 compiles with stricter HTML rules: no unclosed tags, no invalid nesting.
