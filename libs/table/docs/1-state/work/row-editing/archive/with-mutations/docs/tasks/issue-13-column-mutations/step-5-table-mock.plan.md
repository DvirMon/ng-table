# Step 5: `table.mock.ts` — drop the four method stubs

**PR scope:** `table.mock.ts` only.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

**Depends on:** Step 2

## Files

- `libs/shared/design-system/src/ui/table/table.mock.ts` (edit)

## Why This Step Exists

`createMockTableStore()` implements `TableStore<unknown>` for directive DI-wiring tests. After
Step 2 removes the four mutation methods from `TableStore`, the stub object must match — and its
`columns` field, already `signal<ColumnDef<unknown>[]>([])`, already satisfies the new
`WritableSignal` type with no change needed to that line.

## What To Do

- In `createMockTableStore()`'s returned object, delete the four lines: `setColumns: () =>
undefined`, `updateColumns: () => undefined`, `reorderColumns: () => undefined`,
  `toggleColumnVisibility: () => undefined`.
- Leave `columns: signal<ColumnDef<unknown>[]>([])` as-is — `signal()` already returns a
  `WritableSignal`, so this line needs no edit.
- No other change to the file (`mockDataRenderRow` / `mockGroupRenderRow` are unrelated).

## Implementation Notes

- This is a pure deletion — the mock was only ever a stub for DI wiring tests, never asserted on the mutation methods' behavior.

## Risks / Watchouts

- Check any directive spec that imports `createMockTableStore()` and calls
  `store.updateColumns(...)`/etc. directly on the mock instance (as opposed to just using it as a
  DI stub) — none are expected (`directives/` only reads `columns`/`rows`/`renderRows`/`trackBy`
  per the table `CLAUDE.md`'s directive-binding rules), but confirm with a grep before deleting.

## Non-Goals

- Demo app caller — Step 6.

## Acceptance Checks

- `createMockTableStore()` return object has no `setColumns`/`updateColumns`/`reorderColumns`/`toggleColumnVisibility` keys.
- `createMockTableStore()` still typechecks as `TableStore<unknown>`.
- Directive specs using the mock still pass unchanged.

---

← [Step 4: `with-columns-schema` wiring update](step-4-columns-schema-wiring.plan.md) | [Step 6: demo app caller update](step-6-demo-caller.plan.md) →
