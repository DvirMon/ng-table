# Step 1 — `apps/table-bench`: production pages

**PR scope:** A new minimal Nx Angular app whose only job is to be measured. No driver yet.
**Parallel-safe with:** Step 2, Step 3.
**Task type:** `code`
**Skills used:** `angular-developer`
**Scaffolding agent:** `angular-implementer`

## Files

| File                                                  | Action                                                                                             |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `apps/table-bench/project.json`                       | create — `build` (`@angular/build:application`, `production` default), `serve-static`, `typecheck` |
| `apps/table-bench/tsconfig.json`, `tsconfig.app.json` | create — model on `apps/site`                                                                      |
| `apps/table-bench/src/index.html`                     | create — no fonts, no global stylesheet                                                            |
| `apps/table-bench/src/main.ts`                        | create — zoneless bootstrap of `BenchPageComponent`                                                |
| `apps/table-bench/src/bench-page.component.ts`        | create — reads `?variant=` and `?rows=`, renders one variant                                       |
| `apps/table-bench/src/bench-table.component.ts`       | create — the table (plain or animated via an input)                                                |
| `apps/table-bench/src/bare-reorder.ts`                | create — the no-Angular probe (`variant=bare`)                                                     |
| `apps/table-bench/src/after-frame.ts`                 | create — rAF + `MessageChannel` "after next frame" helper                                          |

## Why This Step Exists

Every measurement today runs in dev mode, and two of the three surfaces put both variants in one
document (discovery § Answer, defects 1–2). A production build with one variant per page removes
both. Nothing else may be on the page: its CSS rule count and bundle must stay fixed, or the
numbers drift (§ Decision).

## What To Do

- **Model the build on `apps/site`** (`@angular/build:application`, `@nx/web:file-server` for
  `serve-static`). Default configuration `production`. No SSR, no router.
- **One page, variant by query string** (`?variant=plain|animated|bare&rows=1000`). Each load
  renders exactly one table. Default `rows=1000`.
- **The table** mirrors today's bench (`ngp-table-row-animation.bench.spec.ts`): one `name`
  column, `trackBy: 'id'`, `createMockRows(rows)`, `.bench-cell { height: 24px; padding: 0 8px }`,
  `border-collapse: separate; border-spacing: 0`. `animated` adds `ngpTableRowAnimation`; `plain`
  doesn't. Import `createMockRows` from `@ngp/table`'s mock if exported, else copy the row shape
  and say so in a comment.
- **One button `#reverse`.** Handler, in this order (Preact `reorder1k` shape, discovery § Proposed
  setup):
  `performance.mark('reorder-start')` → `data.update(reverse)` → `await afterFrame()` →
  `performance.measure('reorder', 'reorder-start')`.
- **`afterFrame()`**: resolve inside a `MessageChannel` message posted from a
  `requestAnimationFrame` callback — i.e. after that frame's style/layout/paint. The same helper
  exists as `measureNextFrameRender` in the current bench spec.
- **DOM check hook:** expose `window.__benchFirstRowText = () => …` (first row's text) so the
  driver can assert the reorder happened.
- **`bare` variant:** plain DOM `<table>` of N rows, same CSS, `#reverse` re-appends rows reversed,
  same mark/measure. No Angular component tree beyond the page shell.
- Reduced motion: the page does **not** stub `matchMedia`; the driver sets
  `reducedMotion: 'no-preference'` on the browser context (Step 4).

## Acceptance Checks

- [ ] `nx run table-bench:typecheck` clean (add the target: `ngc -p apps/table-bench/tsconfig.app.json --noEmit`).
- [ ] No global `styles` entry in `project.json`; `index.html` has no `<link rel="stylesheet">`.
- [ ] User runs `nx run table-bench:build` and opens
      `serve-static` → `/?variant=animated` and `/?variant=plain`; Reverse works in both, glide
      visible only in `animated`.
