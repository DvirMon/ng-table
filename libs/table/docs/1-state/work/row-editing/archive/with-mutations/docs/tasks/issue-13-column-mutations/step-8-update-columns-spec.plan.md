# Step 8: `api/update-columns.spec.ts` — unit tests for the free functions

**PR scope:** `api/update-columns.spec.ts` (new) only.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

**Depends on:** Step 3

## Files

- `libs/shared/design-system/src/ui/table/api/update-columns.spec.ts` (new)

## Why This Step Exists

Issue #13's explicit acceptance criterion: "Unit tests for `updateColumns` + all three updaters."
`engine/columns.spec.ts` already covers the pure transforms (`resolveColumnDefs`,
`applyColumnOrder`, `toggleColumnVisible`) that these updaters wrap — this spec covers the
wrapping (updater factories return the right function; `updateColumns` calls `.update()` on the
signal) and is deliberately thin plain-`vitest`, no `TestBed`, no live `createTable()` store.

## What To Do

Mirror `engine/columns.spec.ts`'s style. Test against a minimal fake — `signal<ColumnDef<T>[]>([...])` from `@angular/core`, satisfying `{ columns: WritableSignal<...> }` — not a full mock store:

- `updateColumns`:
  - applies the given updater to the columns signal and the signal reflects the result.
- `setColumns`:
  - `updateColumns(table, setColumns(defs))` replaces the full column list, ignoring the previous one.
  - sparse `ColumnDefInput`s get resolved (`visible`/`order`/`label`/`accessor` defaults) — reuse `engine/columns.spec.ts`'s existing fixtures/assertions for `resolveColumnDefs` rather than re-deriving expectations.
- `reorderColumns`:
  - `updateColumns(table, reorderColumns(ids))` re-assigns `order` per the given id sequence.
  - ids absent from the list leave that column's order untouched.
- `toggleColumnVisibility`:
  - `updateColumns(table, toggleColumnVisibility(id))` flips `visible`; calling it twice returns to the original value.
  - unknown id is a no-op (matches `toggleColumnVisible`'s documented behavior in `engine/columns.ts`).

## Implementation Notes

- These are exactly the six test cases deleted from `create-table.spec.ts` in Step 7, restated against the free-function API instead of store methods — same assertions, different call shape (`updateColumns(table, setColumns(defs))` instead of `store.setColumns(defs)`), plus the two new no-op/idempotency cases for `toggleColumnVisibility` for full coverage of `engine/columns.ts`'s documented "unknown ids are a no-op" behavior.
- Use `libs/shared/design-system/src/ui/table/table.mock.ts` fixtures for row/column shape if convenient, but the fake table object itself is just `{ columns: signal([...]) }` — no need for `createMockTableStore()`'s full `TableStore` shape here.

## Risks / Watchouts

- Don't test `engine/columns.ts`'s pure-transform edge cases again here (e.g. every `resolveColumnDefs` default-filling permutation) — that's `engine/columns.spec.ts`'s job; this file tests the free-function wiring, not the transforms themselves.

## Non-Goals

- Testing `with-columns-schema/wiring.ts`'s use of `updateColumns` — already covered by `with-columns-schema/feature.spec.ts` / `wiring.spec.ts` if one exists; not duplicated here.

## Acceptance Checks

- `update-columns.spec.ts` exists, covers `updateColumns` + `setColumns` + `reorderColumns` + `toggleColumnVisibility`.
- All new tests pass; `create-table.spec.ts` (post Step 7) and `engine/columns.spec.ts` still pass.

---

← [Step 7: remove stale store-method tests](step-7-remove-stale-tests.plan.md) | [Step 9: `table/CLAUDE.md` sync](step-9-claude-md-sync.plan.md) →
