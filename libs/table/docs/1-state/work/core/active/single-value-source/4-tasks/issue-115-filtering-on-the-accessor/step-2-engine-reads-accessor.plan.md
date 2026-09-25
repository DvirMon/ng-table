# Step 2 — The engine reads the accessor

**PR scope:** standalone, behaviour change. **Depends on:** Step 1
(`FiltersPath<TRow, TValues>` is `buildFilterModel`'s parameter type).

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/engine/filters/build.ts` (edit)
- `libs/table/src/engine/filters/evaluator.ts` (edit)
- `libs/table/src/engine/filters/state.ts` (edit — only where `matcher()`
  builds the evaluator)

## Why This Step Exists

`evaluateRecord` reads `rowRecord[path]` (`evaluator.ts:51,63`) — the raw
row field. With a derived accessor the predicate tests a different value
from the one the cell shows. ADR-0024 requires the ADR-0014-wrapped
`readAccessor`, never `column.accessor` directly.

## What To Do

**1. `build.ts` — take a columns getter.**

```ts
export function buildFilterModel<TRow, TValues extends ColumnValueMap, S extends Record<string, AnyRule>>(
  schema: (path: FiltersPath<TRow, TValues>) => S,
  columns: () => readonly ColumnDef<TRow>[]
): Filters<TRow, StateOf<S>>
```

A getter, not an array: `table.columns` is writable (`setColumns`), so
the evaluator must read the current list at evaluation time. Add it to
`FiltersInternal`. `buildFiltersPath` fabricates `{ id }` from any string
key, unchanged apart from its type.

**2. `evaluator.ts` — resolve cells through `readAccessor`.**

Once per evaluator instance (= one evaluation), build
`columnById` from `internal.columns()` and one `reportedColumns` set.
`evaluateRecord` takes a `readCell(columnId, row)` closure instead of
indexing the row. Both the single and the `anyOf` branch use it.

A throwing accessor already degrades to `undefined` inside
`readAccessor` and reports under `[createTable]`; the predicate then sees
`undefined`, same as a null cell. Nothing extra here.

**3. Missing column — degrade, report once.**

A filter whose column is not in `columns()` at evaluation time (removed
by `setColumns()` after construction) is **runtime, data-dependent** —
the same classification as G72 for grouping. Treat it as that filter not
narrowing for this evaluation (add to `droppedKeys` when building
`narrowingRecords`), reported once per key per evaluation. Hiding rows is
the unrecoverable direction; unfiltered is the visible one (ADR-0014).

**4. `reportFilterError` reads the cell through the accessor too**, so
the logged `cell` is the value the predicate actually saw.

## Implementation Notes

- One map and one reported-set per evaluator, never per row — the
  existing `narrowingRecordsMemo` is the right lifetime.
- `buildValueOfContext` is untouched: it reads criterion nodes, not rows.
- `matcher()` is `@internal`; its shape `(row) => boolean` is unchanged.

## Risks / Watchouts

- `build.spec.ts` and `state.spec.ts` call `buildFilterModel(schema)`
  with one argument — red until Step 4. Don't touch them here.
- Don't gate the missing-column report on `ngDevMode`: runtime reports
  ship in production (ADR-0014).

## Non-Goals

- No construction check — Step 3 (it needs the feature's `input`).
- No change to `validateRecords`' one-filter-per-path rule; paths are
  now column ids, the rule reads the same.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean on `src/engine/**`.
- [ ] `evaluator.ts` has no `row as Record<string, unknown>` read left.
- [ ] `readAccessor` is the only way a cell is read in `engine/filters/`.

---
← [Step 1: Re-key the filter type surface](step-1-rekey-filter-types.plan.md) | [Step 3: Widen `withFiltering`'s input](step-3-widen-feature-input.plan.md) →
