# Step 7: `api/create-table.spec.ts` — remove stale store-method tests

**PR scope:** `api/create-table.spec.ts` only.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

**Depends on:** Step 2

## Files

- `libs/shared/design-system/src/ui/table/api/create-table.spec.ts` (edit)

## Why This Step Exists

The six tests at lines 54–116 (`setColumns()`, `updateColumns()` ×2, `reorderColumns()` ×2,
`toggleColumnVisibility()` ×1) assert behavior of methods that no longer exist on the store
(removed in Step 2). Their coverage is superseded by Step 8's `update-columns.spec.ts`, which
tests the same behavior through the free-function form and doesn't need a live `createTable()`
store to do it.

## What To Do

- Delete the six `it(...)` blocks:
  - `'setColumns() replaces the full column list'`
  - `'updateColumns() derives the next column list from the current one'`
  - `'updateColumns() receives the current columns array as its argument'`
  - `'reorderColumns() re-assigns order per the given id sequence'`
  - `'reorderColumns() leaves the order of columns not present in the ids list untouched'`
  - `'toggleColumnVisibility() flips a column visible flag'`
- Leave the surrounding `describe` block structure and any other tests in the file untouched.
- If deleting these six leaves a `describe` block empty, remove the empty `describe` wrapper too (no empty test suites).

## Implementation Notes

- Don't try to salvage these as `updateColumns(store, ...)` calls in-place — that would duplicate Step 8's coverage against a heavier fixture (a live composed store vs. Step 8's plain object). One test suite, one place, per the repo's testing conventions (table `CLAUDE.md`: "Everything in `engine/` ... is pure ... test it with plain vitest").

## Risks / Watchouts

- Confirm no other test in this file depends on state left behind by these six (e.g. a later test in the same `describe` reusing a `store` that assumed a prior mutation ran) — read the surrounding context before deleting, not just the six blocks in isolation.

## Non-Goals

- Writing the replacement coverage — Step 8.

## Acceptance Checks

- `create-table.spec.ts` has no reference to `setColumns`/`updateColumns`/`reorderColumns`/`toggleColumnVisibility`.
- Remaining tests in the file still pass.

---

← [Step 6: demo app caller update](step-6-demo-caller.plan.md) | [Step 8: `update-columns.spec.ts`](step-8-update-columns-spec.plan.md) →
