# Step 1 — Rework data ingress: `data` is the single source of truth

**PR scope:** Independent, deployable on its own.
**Task type:** code
**Stack:** angular
**Skills used:** angular-developer
**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/design-system/src/ui/table/api/types.ts`
- `libs/shared/design-system/src/ui/table/engine/types.ts`
- `libs/shared/design-system/src/ui/table/engine/core.ts`
- `libs/shared/design-system/src/ui/table/api/create-table.ts`

## Why This Step Exists

Resolves issue #11 (D11 in `../../2-decisions.md`). The engine currently keeps an internal
`rawRows` copy fed by a one-way `effect()` off the consumer's `data` signal — under D3/D4 the
consumer's `WritableSignal<TRow[]>` is supposed to be the single source of truth, so the copy
can silently overwrite local row mutations on the next `data` re-emit. This step removes the
copy: the pipeline reads `data()` directly.

## What To Do

1. `api/types.ts`
   - Narrow `TableDataInput<TRow>` from `Signal<TRow[]> | (() => TRow[])` to
     `WritableSignal<TRow[]>` (import `WritableSignal` from `@angular/core`). Update its doc
     comment — it no longer describes a one-way `effect()`.
   - Remove `setData(rows: TRow[]): void` from the `TableStore<TRow>` interface. (Forced,
     not optional: `composeTable()` spreads `TableCore` into the returned store object, and
     `TableCore` loses `setData` in this same step — the interface must match or the store
     object stops satisfying `TableStore<TRow>`.)

2. `engine/types.ts`
   - `TableCore<TRow>`: remove `readonly rawRows: Signal<TRow[]>` and
     `setData(rows: TRow[]): void`.
   - `TableEngineConfig<TRow>`: add `data: TableDataInput<TRow>` (import `TableDataInput` from
     `../api/types`).

3. `engine/core.ts`
   - Delete the `const rawRows = signal<TRow[]>([]);` line.
   - Delete the `setData` method off the returned `core` object.
   - Change `const rows = computed(() => runPipeline(rawRows(), stages));` to
     `const rows = computed(() => runPipeline(config.data(), stages));`.
   - Delete the `rawRows: rawRows.asReadonly(),` line from the returned `core` object.
   - Update the comment above `renderRows` that currently says "not just `rawRows`" / "not
     just on `setData()`" — both no longer exist.

4. `api/create-table.ts`
   - Pass `data` through to `composeTable()`'s config:
     `composeTable<TRow>({ columns, trackBy: config.trackBy, data }, [...])`.
   - Delete `effect(() => store.setData(data()), { injector });` entirely — reactivity now
     comes from `rows`'s `computed()` reading `data()` directly, same mechanism every other
     computed in the engine already uses.
   - Remove the now-unused `effect` import from `@angular/core`.
   - Update the function's doc comment: it currently says "an internal `effect()` re-runs
     `setData()` whenever the source emits" and "`setData()` also stays public as an
     imperative escape hatch" — both are false after this change; describe `data` as read
     directly by the pipeline instead.

## Implementation Notes

- `engine/compose-table.ts` needs no edit — it already forwards its `config` parameter
  (typed `TableEngineConfig<TRow>`) straight into `createTableCore(config)` without
  destructuring individual fields, so the new `data` field flows through untouched.
- `TableCore<TRow>` still has no `data` accessor of its own after this step — only `rows`
  (pipeline output). That is deliberate and matches the current acceptance criteria; do not
  add one speculatively.

## Risks / Watchouts

- Every other caller of `TableCore`/`TableStore`/`TableEngineConfig` that references
  `rawRows`, `setData`, or the old `TableDataInput` union will fail to typecheck until Step 2
  updates the specs — expected, not a regression to chase down mid-step.
- Don't leave `TableEngineConfig.data` optional — it must be required, mirroring `columns`
  and `trackBy`, since the pipeline has no fallback source.

## Non-Goals

- Removing `setData` from anywhere other than `TableCore`/`TableStore` (D7's full removal —
  including any consumer-facing "escape hatch" framing already dies with this step, but no
  broader D7/D12 column-mutation rework; that's issues #12/#48).
- Any change to `PIPELINE_ORDER`, `runPipeline()`, or `engine/pipeline.ts` — pipeline
  mechanics are unaffected, only what feeds them.
- Updating `overview.md`/`prd.md` stale-text call-outs listed in D7 — out of scope for this
  issue.

## Acceptance Checks

- [ ] `engine/core.ts` no longer has `rawRows` or `setData`
- [ ] `api/create-table.ts` no longer has the copy-in `effect()`
- [ ] `engine/types.ts`'s `TableCore` no longer has `rawRows`
- [ ] `TableDataInput<TRow>` is `WritableSignal<TRow[]>`; a `computed()` or plain-thunk source
      no longer compiles
- [ ] Pipeline (`rows`) reads `data()` directly
- [ ] `nx typecheck shared-design-system` fails only in spec files (expected until Step 2)

---

[Step 2: Update engine/create-table specs for the new data ingress](step-2-update-data-ingress-specs.plan.md) →
