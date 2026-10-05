---
title: "Step 9 — fix with-grouping's filter -> group interaction test"
type: task-step
issue: 62
---

# Step 9 — fix `with-grouping`'s filter → group interaction test

**PR scope:** Depends on Step 7. Parallel-safe with Step 8 — different file, no shared state.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/api/features/with-grouping.spec.ts` (edit)

## Why This Step Exists

`with-grouping.spec.ts`'s `'filter -> group pipeline order'` test is the one place outside the
filtering feature's own specs that composes filtering with another feature, and it does so
through the deleted imperative API: `makeFilterableColumns()` sets `filterFn` on the `amount`
column, and the test body calls `store.setColumnFilter('amount', 300)`. Once Step 7 deletes
`ColumnDef.filterFn` and `setColumnFilter`, this file fails to compile — it must move to the new
adapter in the same PR that retires the old one (it cannot ship independently, since the
codebase wouldn't build in between).

## What To Do

- Delete `makeFilterableColumns()` and its doc comment.
- In the `'filter -> group pipeline order'` test: build a `Filters<GroupingMockRow>` via
  `createFilters()` (inside `TestBed.runInInjectionContext`, same as `create-filters.spec.ts`)
  with a rule over `amount` that can exclude the specific row the test currently drops (id 2,
  amount 300) — `equals(path.amount)` or `filter(path.amount, ...)`, whichever reads more
  naturally for "not equal to 300".
- Compose `withFiltering({ filters })` alongside `withGrouping()` in this test's `makeStore()`
  call (use `makeColumns()`, not the deleted filterable variant — filtering no longer reads
  anything off `ColumnDef`).
- Replace `store.setColumnFilter('amount', 300)` with writing directly to the filter's value
  signal (however `create-filters.spec.ts`/Step 8 accesses a child node's `value` — e.g.
  `filters.amount().value.set(...)`) to reproduce "drops id 2."
- Keep every existing assertion in this test unchanged (`usHeader?.aggregates?.['amount']` still
  `75`) — only the setup mechanics change, not the behavior being verified.

## Implementation Notes

- This is the one integration point proving `filtering.md`'s "Resolved Questions" claim that
  `aggregateFn` runs over filtered rows because `group` clusters after `filter` in the fixed
  pipeline order — keep that framing in the test's own comments if it references why the
  assertion holds.

## Risks / Watchouts

- Don't touch any other test in this file — the other grouping/sorting/expansion cases don't
  reference filtering at all and are out of scope.

## Non-Goals

- No new filtering behavior coverage here beyond what's needed to keep this one interaction
  test compiling and passing — full `withFiltering()` coverage is Step 8's job.

## Acceptance Checks

- [ ] File compiles with no reference to `filterFn`, `enableFiltering`, or `setColumnFilter`
- [ ] `'filter -> group pipeline order'` test still asserts `usHeader?.aggregates?.['amount']`
      is `75` post-filter
- [ ] `nx test shared-table` passes

---

← [Step 8: withFiltering() spec](step-8-with-filtering-spec.plan.md)
