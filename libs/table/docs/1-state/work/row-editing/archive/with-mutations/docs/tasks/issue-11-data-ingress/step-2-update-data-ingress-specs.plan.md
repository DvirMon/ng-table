# Step 2 — Update engine/create-table specs for the new data ingress

**PR scope:** Independent, deployable on its own (once Step 1 has landed).
**Task type:** test
**Depends on:** Step 1
**Stack:** angular
**Skills used:** angular-developer, the repo's Angular testing conventions
**Scaffolding agent:** test-implementer

## Files

- `libs/shared/design-system/src/ui/table/table.mock.ts`
- `libs/shared/design-system/src/ui/table/engine/compose-table.spec.ts`
- `libs/shared/design-system/src/ui/table/api/create-table.spec.ts`

## Why This Step Exists

Step 1 removed `TableCore.setData`/`TableStore.setData` and made `TableEngineConfig.data`
required. These three files are the only ones that construct a store/core in tests via the
old shape (`store['setData'](rows)`, `store.setData(rows)`, or a mock implementing the old
`TableStore` interface) — they no longer compile or pass after Step 1 and must be brought in
line with the new contract: seed rows through the `data` signal itself, not through a
mutation method.

## What To Do

1. `table.mock.ts`
   - Remove `setData: () => undefined,` from `createMockTableStore()`'s returned object —
     `TableStore<unknown>` no longer declares the member, so the mock over-satisfies (and
     will now over-error) without it removed.

2. `engine/compose-table.spec.ts`
   - `composeTable(config, features)`'s `config` (`TableEngineConfig<Row>`) now requires
     `data`. Replace the module-level `const config: TableEngineConfig<Row> = { columns,
     trackBy: 'id' };` pattern with a per-test signal so each test controls its own rows,
     e.g. build a small `composeWithRows(rows, features)` helper that creates
     `const data = signal(rows);` and calls
     `composeTable({ columns, trackBy: 'id', data }, features)` — mirroring how
     `create-table.spec.ts` already takes rows via `signal(...)`.
   - Every test currently doing `(store['setData'] as (rows: Row[]) => void)(makeRows())`
     (or an inline row array) after `compose([...])` should instead pass the rows in at
     construction via the new helper's `data` signal — there is no post-construction write
     path anymore. Where a test currently calls `setData` in the middle (none currently
     re-seed twice), just seed once up front.
   - The `'gives each composition independent state'` test currently calls `setData` on
     `first` only, after both are composed, to prove no shared state — rewrite it to
     construct `first` with a non-empty `data` signal and `second` with an empty one, and
     assert the same isolation.

3. `api/create-table.spec.ts`
   - Every `store.setData(rows)` call becomes seeding the `data` signal used to construct the
     store: either pass the rows straight into `signal(...)` at `createTable(signal(rows),
     ...)`, or, if the test wants to change rows mid-test, call `data.set(rows)` on the same
     signal reference passed into `createTable`.
   - `'auto-populates rows from the data signal via the internal effect'`: rename to describe
     the new mechanism (e.g. `'rows reflect the data signal directly, no internal effect'`)
     and drop the `TestBed.tick()` calls — they existed only to flush the removed `effect()`;
     `store.rows()` is now a `computed()` reading `data()`, so it reflects a `data.set(...)`
     synchronously on next read, no flush needed. Keep the same before/after assertions
     (single row, then two rows after `data.set(...)`).
   - `'renderRows() 1:1-wraps rows() when no grouping is composed'`,
     `'renderRows() derives its ids from trackBy'`, and
     `'gives each createTable() call independent state'`: replace their `store.setData(rows)`
     call with constructing the store via `createTable(signal(rows), ...)` directly (these
     tests don't need rows to change after construction, so pass them in up front).
   - `'renderRows() recomputes downstream of the pipeline, not just rawRows'` already
     constructs via `signal([...])` and only calls `TestBed.tick()` — drop the `TestBed.tick()`
     call for the same reason as above; keep everything else (the test's docstring/name
     references "not just rawRows", which is now stale prose — reword to "not just `data`
     re-emits" or similar, since `rawRows` no longer exists to contrast against).

## Implementation Notes

- No `TestBed.tick()` is needed anywhere in these two spec files after this step — the only
  thing that ever required a flush was the removed `effect()`. If any test still calls it,
  that's a leftover, not a requirement.
- Keep every test's assertions (expected values) unchanged — this step only changes how rows
  get into the store, not what's asserted about the result.

## Risks / Watchouts

- Don't leave a `TableEngineConfig` literal without `data` anywhere in
  `compose-table.spec.ts` — TypeScript will catch it, but scan for any second/third config
  object beyond the module-level one (e.g. inline literals in individual tests) if any exist.
- The `'runs onDestroy hooks when the owning injector is destroyed'` and
  `'shows a feature only earlier features' members at factory time'` tests in
  `compose-table.spec.ts` call `composeTable(config, ...)` directly with the shared
  module-level `config` — if that constant is removed in favor of a per-test signal, make
  sure these two still get a valid `data` (an empty `signal([])` is fine; they don't assert
  on rows).

## Non-Goals

- Adding new test coverage beyond what already exists — this is a mechanical update to match
  the new construction contract, not a coverage expansion.
- Touching `engine/pipeline.spec.ts` — it tests `runPipeline()` directly with plain arrays and
  never references `setData`/`rawRows`/`TableDataInput`; unaffected by Step 1.

## Acceptance Checks

- [ ] Existing engine/pipeline unit tests updated and passing
- [ ] `nx test shared-design-system` passes with no `setData` references remaining in
      `table.mock.ts`, `engine/compose-table.spec.ts`, or `api/create-table.spec.ts`
- [ ] `nx typecheck shared-design-system` passes clean

---
← [Step 1: Rework data ingress](step-1-rework-data-ingress.plan.md)

Issue #11 ends here. Next issue: [#12 — row mutation free functions](../issue-12-row-mutations/step-1-expose-data-on-core.plan.md).
