# Step 6: `apps/demo/table-demo.ts` — switch to the free function

**PR scope:** `apps/demo/src/app/table-demo/table-demo.ts` only.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

**Depends on:** Step 3

## Files

- `apps/demo/src/app/table-demo/table-demo.ts` (edit)

## Why This Step Exists

`TableDemo`'s constructor `effect()` calls `this.table.updateColumns((columns) => ...)` to patch
the `age` column's visibility from a permission `resource()` — the acceptance criteria's "All
callers in `directives/` and `apps/demo/` updated to the free-function form" (no `directives/`
caller exists today per Step 4/5's investigation, so this is the only remaining production
caller).

## What To Do

- Add `updateColumns` to the existing `@acme/shared-design-system/ui` import (alongside
  `createTable`, `type SortDirection`).
- In the constructor `effect()`, replace:
  ```ts
  this.table.updateColumns((columns) =>
    columns.map((column) =>
      column.id === 'age' ? { ...column, visible: allowed } : column,
    ),
  );
  ```
  with:
  ```ts
  updateColumns(this.table, (columns) =>
    columns.map((column) =>
      column.id === 'age' ? { ...column, visible: allowed } : column,
    ),
  );
  ```
- Update the comment above `ageColumnPermission` — it currently reads "the store only exposes
  `updateColumns()` as a plain mutator"; reword to reflect that `updateColumns()` is now a free
  function taking the table, not a store method.
- Check `table-demo.mock.ts:11`'s comment (`// updateColumns() driven from a resource()/effect().
  Not a real check.`) for the same staleness; reword if it implies a store method.

## Implementation Notes

- This is the exact pattern the raw-lambda escape hatch was designed for (D6/D19: "a raw lambda
  covers them until a real caller appears") — the demo's permission-driven visibility patch stays
  a raw updater, not `toggleColumnVisibility()`, since it derives `visible` from an external value
  rather than flipping the current one.

## Risks / Watchouts

- Don't swap this call to `toggleColumnVisibility('age')` — that flips the *current* value, not
  set it to `allowed`; behavior would silently diverge from today's demo.

## Non-Goals

- Any other demo behavior change.

## Acceptance Checks

- `table-demo.ts` imports `updateColumns` from `@acme/shared-design-system/ui`.
- No remaining `this.table.updateColumns(...)` call in the file.
- Demo still typechecks; behavior (age column visibility follows `ageColumnPermission`) unchanged.

---
← [Step 5: `table.mock.ts`](step-5-table-mock.plan.md) | [Step 7: remove stale store-method tests](step-7-remove-stale-tests.plan.md) →
