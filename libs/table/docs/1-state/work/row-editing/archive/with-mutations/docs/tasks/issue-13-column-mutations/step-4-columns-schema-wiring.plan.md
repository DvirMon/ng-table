# Step 4: `with-columns-schema` — switch internal wiring to the free function

**PR scope:** `api/column-schema.types.ts`, `api/features/with-columns-schema/wiring.ts` only.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

**Depends on:** Step 3

## Files

- `libs/shared/design-system/src/ui/table/api/column-schema.types.ts` (edit)
- `libs/shared/design-system/src/ui/table/api/features/with-columns-schema/wiring.ts` (edit)

## Why This Step Exists

`with-columns-schema/wiring.ts` is the one production caller of the store's `updateColumns()`
method today (its `patchColumnVisible()` helper calls `store.updateColumns(...)` to reactively
patch a column's `visible` flag from `applyVisible`/`applyVisibleAsync` rules). It's an internal
engine-facing caller, not a directive/demo caller — split from Step 6 (demo) because this one
touches the `ColumnsSchemaStore` contract type too.

## What To Do

- `api/column-schema.types.ts`: `ColumnsSchemaStore<TRow>` interface —
  - Change `readonly columns: () => ColumnDef<TRow>[]` to `readonly columns: WritableSignal<ColumnDef<TRow>[]>` (import `WritableSignal` from `@angular/core`, alongside the existing `Signal` import).
  - Delete `readonly updateColumns: (updater: ...) => void`.
- `api/features/with-columns-schema/wiring.ts`:
  - Import `updateColumns` from `../../update-columns` (alongside the existing `setColumnVisible` import from `../../../engine/columns`).
  - `patchColumnVisible()`: replace `store.updateColumns((columns) => setColumnVisible(columns, columnId, visible));` with `updateColumns(store, (columns) => setColumnVisible(columns, columnId, visible));`.
  - No other change — `wireReactiveVisibleRules` / `wireAsyncVisibleRule` call `patchColumnVisible()` exactly as before.

## Implementation Notes

- `ColumnsSchemaStore<TRow>` after this step structurally satisfies `update-columns.ts`'s `{ columns: WritableSignal<ColumnDef<TRow>[]> }` parameter type — this is exactly the cross-caller reuse Step 3's minimal typing was chosen for.
- `feature.ts` (the third file in this folder) references neither `updateColumns` nor `ColumnsSchemaStore.columns` directly — no change expected there, but re-check its imports/JSDoc comment ("wires reactive/async column-schema rules to the store's own `updateColumns()`") for staleness; update the comment wording to reflect the free-function call if it still says "the store's own."

## Risks / Watchouts

- `ColumnsSchemaStore` is a narrower structural type than `TableCore` — verify `createTable()`'s call site (`api/create-table.ts`, passing `store` into `withColumnsSchemaAsync<TRow>(rules)` via `composeTable`) still satisfies it after `TableCore.columns` becomes `WritableSignal` (Step 1); it should, since `WritableSignal` is assignable in both directions here, but confirm with a typecheck rather than assuming.
- `with-columns-schema/feature.spec.ts` may mock a `ColumnsSchemaStore` with `columns: () => [...]` and/or an `updateColumns` stub — update the mock shape if the test file breaks.

## Non-Goals

- Demo app caller (`table-demo.ts`) — Step 6.
- `table.mock.ts` — Step 5.

## Acceptance Checks

- `ColumnsSchemaStore.columns` is `WritableSignal<ColumnDef<TRow>[]>`; `updateColumns` field removed.
- `wiring.ts` calls the imported `updateColumns(store, updater)` free function, not a store method.
- `with-columns-schema/*.spec.ts` still passes (fixed in this step if the mock shape needed updating).

---

← [Step 3: `api/update-columns.ts`](step-3-update-columns-free-functions.plan.md) | [Step 5: `table.mock.ts`](step-5-table-mock.plan.md) →
