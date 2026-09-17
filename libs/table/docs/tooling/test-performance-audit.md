# Test performance audit — `shared-table`

Date: 2026-09-14 · Baseline run: 615 passed / 1 todo (616), wall **17.88s**, Nx cache miss.

```
Duration 17.88s (transform 20.39s, setup 66.27s, import 27.94s, tests 17.64s, environment 139.66s)
```

## 1. Read the numbers correctly first

The four inflated figures are **not** four blocks of wall-clock work.

| Figure | What it actually is |
|---|---|
| `environment 139.66s` | `_environmentTime` is measured **once per worker** and then copied onto **every file's** duration (`vitest/dist/chunks/base.*.js`: `state.durations.environment = _environmentTime`). Real cost ≈ 139.66 / 33 ≈ **4.2s per worker**, paid in parallel at startup. |
| `setup 66.27s` | Same shape. `init-testbed.js` is guarded by `Symbol.for('@angular/cli/testbed-setup')` and its body runs **once per worker**; the rest is cached module re-entry attributed per file. ≈ 2.0s per worker. |
| `transform` / `import` | Sums across workers, not wall time. |
| `tests 17.64s` | Sum of test-body time across all 33 files. Spread over N workers this is ~2–3s wall. |

**Conclusion: the suite body is ~2–3s. The other ~15s is startup.** Every lever below targets startup; none targets the tests themselves.

## 2. Where the mechanism actually spends its startup

Config chain (there is no checked-in vitest config — it is all generated):

- `project.json` → `@nx/angular:unit-test` → `@angular/build:unit-test` (runner `vitest`).
- `@angular/build/.../vitest/plugins.js` sets the project defaults: `globals: true`, **`isolate: false`** (already optimal), `sequence.setupFiles: 'list'`, and `environment: await findTestEnvironment(...)`.
- `findTestEnvironment` resolves **`happy-dom` if installed, else falls back to `jsdom`**.
- `@angular/build/.../vitest/configuration.js` looks for **`vitest-base.config.{ts,mts,cts,js,mjs,cjs}`** in `projectRoot` then `workspaceRoot`. That file is the only supported escape hatch for anything the executor schema does not expose.

### Findings

**F1 — `jsdom@22.1.0`, and nothing in the suite needs a DOM.**
`happy-dom` is not installed, so the builder falls back to jsdom. The installed jsdom is pinned `~22.1.0` (Oct 2023); vitest 4 runs fine on jsdom 26/27. Importing + constructing jsdom is the bulk of the ~4.2s per-worker environment cost.

**F2 — 32 of 33 spec files never touch the DOM.**
TestBed API usage across the suite:

```
71  TestBed.tick
65  TestBed.runInInjectionContext
 5  TestBed.createComponent      ← all in one file
 4  TestBed.configureTestingModule
 3  TestBed.inject
 2  TestBed.resetTestingModule
 1  TestBed.flushEffects
```

`src/directives/ngp-table-row-field.directive.spec.ts` is the **only** file that renders (11 `createComponent`/`detectChanges` hits, 4 tests). The other 32 files are signal/injector tests that need an injection context, not a document.

**F3 — coverage is unconditionally on.**
`project.json` hardcodes `"coverage": true` on the `test` target. Every local run pays v8 instrumentation + the remap over 1400 statements, even when nobody reads the report.

**F4 — zoneless, so there is no zone.js cost to remove.**
`zone.js` is not installed and all `polyfills` arrays are `[]`. `prepareSetupFiles` therefore only prepends `polyfills.js` if the build emitted one — it did not. Setup files are `init-testbed.js` + `vitest-mock-patch.js`. Nothing to win here.

**F5 — nothing is pathological at the test level.**
Largest files are 46 tests (`optimistic-mutations.spec.ts`, `with-grouping.spec.ts`); no `fakeAsync`, no real timers, no oversized fixtures found. The tests are not the problem.

## 3. Recommended changes, highest value first

### R1 — install `happy-dom` (one line, zero config)

```bash
npm i -D happy-dom
```

The builder auto-detects it and prefers it over jsdom — no config change, no code change. Expect the per-worker environment cost to drop from ~4.2s to well under 1s.

### R2 — move the DOM-needing spec onto its own environment, run the rest in `node`

Only worth doing after R1 is measured; it is strictly larger than R1 and carries a real risk (below).

Create `libs/table/vitest-base.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

and put a docblock on the one renderer spec:

```ts
// @vitest-environment happy-dom
```

**Risk to verify before adopting:** `init-testbed.js` calls
`getTestBed().initTestEnvironment([BrowserTestingModule, TestModule], platformBrowserTesting(), ...)`,
which may touch `document` at init even for injector-only tests. If it throws under `environment: 'node'`, R2 is not available and R1 is the ceiling. This is a 5-minute experiment, not an assumption.

### R3 — make coverage a configuration, not the default

```jsonc
// libs/table/project.json
"test": {
  "executor": "@nx/angular:unit-test",
  "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
  "options": { "watch": false },
  "configurations": {
    "coverage": { "coverage": true }
  }
}
```

`nx test shared-table` stays fast for the inner loop; `nx test shared-table -c coverage` is the CI/gate run.

### R4 — bump jsdom if R1 is rejected

`jsdom ~22.1.0` → `^27`. Only relevant as a fallback if happy-dom is ruled out for fidelity reasons.

### R5 — connect or disable Nx Cloud

The run emitted `Nx Cloud encountered some problems … not connected (code: 401)`. It costs a failed round-trip on every invocation and produces no remote cache. Either claim the workspace or remove `nxCloudId` from `nx.json`.

## 4. How to measure (run these yourself)

Each is one cold run; compare `Duration` and the `environment` figure.

```bash
# baseline, cold
npx nx reset && npx nx test shared-table --skip-nx-cache

# after R1
npm i -D happy-dom
npx nx test shared-table --skip-nx-cache

# after R3, inner-loop shape
npx nx test shared-table --skip-nx-cache          # no coverage
npx nx test shared-table -c coverage --skip-nx-cache
```

Read `environment / 33` as the per-worker figure, not a total — see §1.

## 5. What is already optimal — do not touch

- `isolate: false` is the builder default and is already in effect.
- Zoneless: no zone.js in the setup chain.
- Nx local cache works (the run that produced this baseline was a 1/1 cache hit at 667ms).
- Test bodies: no slow patterns found.

## 6. Applied (2026-09-14)

- **R1** — `npm i -D happy-dom` → `happy-dom@20.14.5` (resolves from `libs/table/src`). No config change needed; `findTestEnvironment` prefers it over jsdom automatically.
- **R3** — `project.json`: `coverage` moved off `options` into a `coverage` configuration.
  - `nx test shared-table` → no coverage (inner loop).
  - `nx test shared-table -c coverage` → coverage report.
  - **Open**: `.github/workflows/ci.yml:38` runs `npx nx run-many -t lint test build`, so **CI no longer produces a coverage report**. No `coverageThresholds` were configured, so nothing was gating on it — but if the report is wanted in CI it needs its own step (`run-many -c coverage` would also apply the configuration to projects that do not define it).

Not applied: R2 (needs the `environment: 'node'` probe first), R4 (moot once happy-dom is in), R5 (Nx Cloud — owner decision).
