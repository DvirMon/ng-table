# Step 2: `api/types.ts` — public `TableStore` mirrors the writable-columns change

**PR scope:** `api/types.ts` only.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

**Depends on:** Step 1

## Files

- `libs/shared/design-system/src/ui/table/api/types.ts` (edit)

## Why This Step Exists

`TableStore<TRow>` is the consumer-facing mirror of `TableCore<TRow>` (Step 1). Both must move
together — a public `TableStore.columns: Signal<...>` next to an engine-internal
`WritableSignal` would make `composeTable()`'s `Object.assign` a type lie.

## What To Do

- Import `WritableSignal` from `@angular/core` (already imports `Signal`, `WritableSignal` — check current import list, `WritableSignal` is already imported for `TableDataInput`).
- `TableStore<TRow>` interface:
  - Change `readonly columns: Signal<ColumnDef<TRow>[]>` to `readonly columns: WritableSignal<ColumnDef<TRow>[]>`.
  - Delete `setColumns`, `updateColumns`, `reorderColumns`, `toggleColumnVisibility` method signatures.
- Keep `ColumnsUpdater<TRow>` exactly as-is — it's now purely the free function's updater type (Step 3 imports it), no longer also a method-parameter type.

## Implementation Notes

- Don't touch `ColumnDef`, `ColumnDefInput`, or any of the other types in this file — scope is the `TableStore` interface only.
- `ComposedFeatureMembers<Features>` and the rest of the file are unaffected.

## Risks / Watchouts

- `api/create-table.spec.ts` currently asserts on `store.setColumns(...)` etc. — those tests will fail to compile after this step. Fixing them is Step 7 (kept separate: this step is pure type surface, Step 7 is test-content decisions about what replaces the coverage).
- `table.mock.ts`'s `createMockTableStore()` implements `TableStore` and stubs the four methods — it will fail to compile too. Fixing it is Step 5, not this step.
- It is expected and fine for the package to not typecheck end-to-end until Step 6 lands — each step here is reviewable but not independently green until the caller-update steps (4–6) complete. Note this in the PR description if `/implement` runs full-repo typecheck per step.

## Non-Goals

- Free-function implementation — Step 3.
- Caller fixes — Steps 4–6.

## Acceptance Checks

- `TableStore.columns` is `WritableSignal<ColumnDef<TRow>[]>`.
- `TableStore` has no `setColumns`/`updateColumns`/`reorderColumns`/`toggleColumnVisibility`.
- `ColumnsUpdater<TRow>` unchanged.

---
← [Step 1: `engine/core.ts` + `engine/types.ts`](step-1-core-writable-columns.plan.md) | [Step 3: `api/update-columns.ts` — the free functions](step-3-update-columns-free-functions.plan.md) →
