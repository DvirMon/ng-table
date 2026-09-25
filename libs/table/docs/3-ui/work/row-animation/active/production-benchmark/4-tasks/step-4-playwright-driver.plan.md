# Step 4 — Playwright driver

**PR scope:** The script that serves the built app, samples both variants round-robin in fresh
pages, applies Step 2's gate, and takes one trace per variant through Step 3.
**Depends on:** Step 1, Step 2, Step 3.
**Task type:** `code`
**Skills used:** —
**Scaffolding agent:** `general-purpose`

## Files

| File | Action |
|---|---|
| `apps/table-bench/driver/bench.ts` | create — entry point |
| `apps/table-bench/driver/static-server.ts` | create — `node:http` server over the build output |
| `apps/table-bench/driver/tsconfig.json` | create — `noEmit`, `module: nodenext`, strip-types compatible |

## Why This Step Exists

Discovery § Proposed setup › Driver. One harness that both samples and traces the same page,
instead of three surfaces (Vitest bench, `bench-trace`, the Storybook story).

## What To Do

- **Serve:** static server on a free port over `dist/apps/table-bench/browser` (or wherever
  Step 1's build outputs — read it from `project.json`, don't hard-code a second copy).
- **Browser:** `chromium.launch()` from the installed `playwright` package (not
  `@playwright/test`). Headed by default (jfb's paint-skipping warning [S9]); `--headless` flag
  switches to `channel: 'chromium'`. Args: `--js-flags=--expose-gc`. Context: fixed viewport
  (1280×800), `reducedMotion: 'no-preference'`.
- **Sample loop**, per row count (default `[1000]`, flag for `100,1000,5000,10000`):
  - Alternate `plain`, `animated` (round-robin). Each sample: **new page** → `goto
    /?variant=X&rows=N` → 5 warm-up clicks on `#reverse` (wait for each `reorder` measure) →
    `window.gc()` → 1 measured click → read the last `reorder` measure's duration → check
    `__benchFirstRowText()` changed → close page.
  - Minimum 25 samples per variant; after that, stop when `isResolved(interval, 16.7)` or after
    3 minutes (tachometer's timeout [S11]).
- **Trace:** after sampling, one extra sample per variant under CDP
  `Tracing.start({ transferMode: 'ReturnAsStream', traceConfig: { includedCategories } })`
  (jfb's categories [S36]); read via `IO.read`; write `dist/table-bench/trace-<variant>-<N>.json`;
  print `formatTraceSummary()`.
- **Report:** a plain-text table per N: `plain` / `animated` median + IQR, difference interval
  `[low, high]`, n per variant, verdict. Also run `bare` for N=1000 as a report-only reference.
- **Exit code:** 1 only when the N=1000 verdict is `fail`; `unsure` prints a loud line and exits 0.
- **Optional flag** `--cpu-throttle=4` → `Emulation.setCPUThrottlingRate` on every page,
  report-only.

## Acceptance Checks

- [ ] `npx tsc -p apps/table-bench/driver/tsconfig.json --noEmit` clean (plain TS, no templates).
- [ ] No new dependency in `package.json`.
