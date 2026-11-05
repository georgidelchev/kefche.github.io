# Patches

Dependency patches applied by pnpm on install (`patchedDependencies` in `pnpm-workspace.yaml`). Each one is a workaround: drop it once a release fixes the problem. To change one, run `pnpm patch <pkg>@<version>`, edit, then `pnpm patch-commit <dir>`.

## frimousse@0.4.0

The emoji grid numbered its rows and cells from 0, but `aria-rowindex` and `aria-colindex` start at 1, so axe reports `aria-valid-attr-value` on the picker (Phase 8 step 13). The library's files are minified onto one line each, so the diff is the whole file. The change is three replacements, the same in `dist/index.js` and `dist/index.cjs`:

| Was                                 | Now                                   |
| ----------------------------------- | ------------------------------------- |
| `"aria-colindex":t,`                | `"aria-colindex":t+1,`                |
| `"aria-rowindex":t?void 0:e,`       | `"aria-rowindex":t?void 0:e+1,`       |
| `[aria-rowindex="${R}"]` (selector) | `[aria-rowindex="${R+1}"]` (selector) |

The third keeps keyboard navigation scrolling the active row into view, since the library finds that row by its `aria-rowindex`.
